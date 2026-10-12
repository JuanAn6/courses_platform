"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { NativeSelect } from "@/components/native-select";
import { enrollStudents, moveStudent, withdrawStudents } from "@/features/academics/enrollment-actions";
import type { ActionState } from "@/lib/actions";

type Member = {
  userId: string;
  name: string;
  email: string;
  code: string;
  status: "ACTIVE" | "WITHDRAWN" | "COMPLETED";
  since: string;
  ended: string | null;
  note: string | null;
};

function report(res: ActionState<unknown>) {
  if (res.status === "error") toast.error(res.message);
  else if (res.status === "success" && res.message) toast.success(res.message);
  return res.status === "success";
}

export function RosterTable({
  classId,
  members,
  targets,
}: {
  classId: string;
  members: Member[];
  targets: { id: string; label: string; seatsLeft: number | null }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const active = members.filter((m) => m.status === "ACTIVE");
  const past = members.filter((m) => m.status !== "ACTIVE");
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{selected.size ? `${selected.size} selected` : "Select students to withdraw them."}</p>
        <ConfirmButton
          run={async () => {
            const res = await withdrawStudents({ classId, userIds: [...selected] });
            if (res.status === "success") setSelected(new Set());
            return res;
          }}
          disabled={selected.size === 0}
          label={<><UserMinus /> Withdraw selected</>}
          title={`Withdraw ${selected.size} student${selected.size === 1 ? "" : "s"}?`}
          description="They lose access to the class. Their history (and later, grades) is kept and they can be re-enrolled."
          confirmLabel="Withdraw"
          destructive
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="size-4 accent-primary"
                  checked={active.length > 0 && selected.size === active.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(active.map((m) => m.userId)) : new Set())}
                />
              </TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Since</TableHead>
              <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No students enrolled yet.</TableCell>
              </TableRow>
            ) : (
              active.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${m.name}`}
                      className="size-4 accent-primary"
                      checked={selected.has(m.userId)}
                      onChange={() => toggle(m.userId)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{m.code}</span>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{m.since}</TableCell>
                  <TableCell>
                    <MoveDialog classId={classId} member={m} targets={targets} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {past.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Past students ({past.length})</summary>
          <ul className="mt-2 divide-y">
            {past.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {m.name} <span className="font-mono text-xs text-muted-foreground">{m.code}</span>
                  {m.note ? <span className="block text-xs text-muted-foreground">{m.note}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="mr-2">{m.status === "WITHDRAWN" ? "Withdrawn" : "Completed"}</Badge>
                  {m.since} → {m.ended ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function MoveDialog({
  classId,
  member,
  targets,
}: {
  classId: string;
  member: Member;
  targets: { id: string; label: string; seatsLeft: number | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Move ${member.name}`}>
          <ArrowRightLeft /> Move
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {member.name}</DialogTitle>
          <DialogDescription>They are withdrawn from this class and enrolled in the one you choose.</DialogDescription>
        </DialogHeader>
        <label htmlFor={`move-${member.userId}`} className="text-sm font-medium">Move to</label>
        <NativeSelect id={`move-${member.userId}`} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Choose a class…</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id} disabled={t.seatsLeft !== null && t.seatsLeft <= 0}>
              {t.label}
              {t.seatsLeft !== null ? ` — ${Math.max(0, t.seatsLeft)} seats left` : ""}
            </option>
          ))}
        </NativeSelect>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!target || pending}
            onClick={() =>
              startTransition(async () => {
                if (report(await moveStudent({ fromClassId: classId, toClassId: target, userId: member.userId }))) setOpen(false);
              })
            }
          >
            {pending ? "Moving…" : "Move student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddStudents({
  classId,
  q,
  candidates,
}: {
  classId: string;
  q: string;
  candidates: { id: string; name: string; email: string; code: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-3">
      <form className="flex gap-2" role="search">
        <input type="hidden" name="classId" value={classId} />
        <label htmlFor="student-search" className="sr-only">Search students</label>
        <Input id="student-search" name="q" placeholder="Name, email or code" defaultValue={q} />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching students.</p>
      ) : (
        <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
          {candidates.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={selected.has(c.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                />
                <span>
                  {c.name} <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                  <span className="block text-xs text-muted-foreground">{c.email}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          disabled={selected.size === 0 || pending}
          onClick={() =>
            startTransition(async () => {
              if (report(await enrollStudents({ classId, userIds: [...selected] }))) setSelected(new Set());
            })
          }
        >
          <UserPlus /> {pending ? "Enrolling…" : selected.size ? `Enroll ${selected.size} selected` : "Enroll selected"}
        </Button>
      </div>
    </div>
  );
}
