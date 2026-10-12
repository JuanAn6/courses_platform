"use client";

import { useState, useTransition } from "react";
import { CalendarClock, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { setOverride } from "@/features/entries/actions";
import { EntryIcon } from "@/features/entries/components/entry-icon";
import { cn } from "@/lib/utils";

type OverrideValues = { hidden: boolean; releaseAt: string; dueAt: string };
type Entry = {
  id: string;
  type: string;
  title: string;
  draft: boolean;
  hidden: boolean;
  availableLabel: string | null;
  dueLabel: string | null;
  override: OverrideValues;
};
type Unit = { id: string; title: string; hidden: boolean; availableLabel: string | null; override: OverrideValues; entries: Entry[] };

export function OverrideOutline({ classId, canEdit, timezone, units }: { classId: string; canEdit: boolean; timezone: string; units: Unit[] }) {
  if (units.length === 0) return <p className="text-sm text-muted-foreground">The course has no content yet.</p>;
  return (
    <div className="grid gap-3">
      {units.map((u) => (
        <Card key={u.id} className={cn("gap-2", u.hidden && "opacity-70")}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold">{u.title}</h3>
              <p className="text-xs text-muted-foreground">{u.availableLabel ? `Opens ${u.availableLabel}` : "Always open"}</p>
            </div>
            <span className="flex items-center gap-2">
              {u.override.hidden ? <Badge variant="secondary"><EyeOff className="size-3" /> Hidden in this class</Badge> : null}
              {canEdit ? <OverrideDialog key={JSON.stringify(u.override)} classId={classId} kind="unit" id={u.id} title={u.title} values={u.override} timezone={timezone} /> : null}
            </span>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1">
              {u.entries.map((e) => (
                <li key={e.id} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm", e.hidden && "text-muted-foreground")}>
                  <EntryIcon type={e.type} />
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  <span className="hidden text-xs text-muted-foreground md:inline">
                    {e.availableLabel ? `Opens ${e.availableLabel}` : ""}
                    {e.dueLabel ? ` · Due ${e.dueLabel}` : ""}
                  </span>
                  {e.draft ? <Badge variant="outline">Draft</Badge> : null}
                  {e.override.hidden ? <Badge variant="secondary"><EyeOff className="size-3" /> Hidden</Badge> : null}
                  {e.override.releaseAt || e.override.dueAt ? <Badge variant="secondary"><CalendarClock className="size-3" /> Class dates</Badge> : null}
                  {canEdit ? <OverrideDialog key={JSON.stringify(e.override)} classId={classId} kind="entry" id={e.id} title={e.title} values={e.override} timezone={timezone} /> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OverrideDialog({
  classId,
  kind,
  id,
  title,
  values,
  timezone,
}: {
  classId: string;
  kind: "unit" | "entry";
  id: string;
  title: string;
  values: OverrideValues;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(values.hidden);
  const [releaseAt, setReleaseAt] = useState(values.releaseAt);
  const [dueAt, setDueAt] = useState(values.dueAt);
  const [pending, start] = useTransition();

  const save = (next: OverrideValues) =>
    start(async () => {
      const res = await setOverride({ classId, kind, targetId: id, ...next });
      if (res.status === "error") toast.error(res.message);
      else {
        toast.success(res.status === "success" && res.message ? res.message : "Saved.");
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Class settings for ${title}`}>
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Changes apply to this class only. Leave dates empty to use the course&apos;s dates.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="size-4 accent-primary" />
            Hide from students in this class
          </label>
          <FormField id={`ov-release-${id}`} label="Available from" hint={`Times are in ${timezone}.`}>
            <Input id={`ov-release-${id}`} type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} />
          </FormField>
          {kind === "entry" ? (
            <FormField id={`ov-due-${id}`} label="Due">
              <Input id={`ov-due-${id}`} type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </FormField>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => save({ hidden, releaseAt, dueAt })}>{pending ? "Saving…" : "Save for this class"}</Button>
            <Button variant="ghost" disabled={pending} onClick={() => save({ hidden: false, releaseAt: "", dueAt: "" })}>
              Use course settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
