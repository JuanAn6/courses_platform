"use client";

import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { addClassStaff, cloneClass, removeClassStaff } from "@/features/academics/class-actions";
import { canHoldClassRole } from "@/features/academics/rules";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";
import type { Role } from "@/lib/auth/permissions";

type StaffMember = { id: string; name: string; email: string; role: "TEACHER" | "ASSISTANT" };

export function StaffPanel({
  classId,
  staff,
  candidates,
}: {
  classId: string;
  staff: StaffMember[];
  candidates: { id: string; name: string; roles: Role[] }[];
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"TEACHER" | "ASSISTANT">("TEACHER");
  const [pending, startTransition] = useTransition();
  const eligible = candidates.filter((c) => !staff.some((s) => s.id === c.id) && canHoldClassRole(c.roles, role));

  return (
    <div className="grid gap-3">
      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff assigned yet.</p>
      ) : (
        <ul className="divide-y">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                {s.name} <Badge variant="outline" className="ml-1">{s.role === "TEACHER" ? "Teacher" : "Assistant"}</Badge>
                <span className="block text-xs text-muted-foreground">{s.email}</span>
              </span>
              <ConfirmButton
                variant="ghost"
                run={() => removeClassStaff({ classId, userId: s.id })}
                label={<><UserMinus /><span className="sr-only">Remove {s.name}</span></>}
                title={`Remove ${s.name} from this class?`}
                description="They lose access to the class. You can add them again later."
                confirmLabel="Remove"
                destructive
              />
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2">
        <div className="grid grid-cols-[8rem_1fr] gap-2">
          <label htmlFor="staff-role" className="sr-only">Role</label>
          <NativeSelect id="staff-role" value={role} onChange={(e) => { setRole(e.target.value as "TEACHER" | "ASSISTANT"); setUserId(""); }}>
            <option value="TEACHER">Teacher</option>
            <option value="ASSISTANT">Assistant</option>
          </NativeSelect>
          <label htmlFor="staff-user" className="sr-only">Person</label>
          <NativeSelect id="staff-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Choose a person…</option>
            {eligible.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Button
            variant="outline"
            disabled={!userId || pending}
            onClick={() =>
              startTransition(async () => {
                const res = await addClassStaff({ classId, userId, role });
                if (res.status === "error") toast.error(res.message);
                else if (res.status === "success") {
                  toast.success(res.message ?? "Added.");
                  setUserId("");
                }
              })
            }
          >
            Add to staff
          </Button>
        </div>
      </div>
    </div>
  );
}

const initial: ActionState = { status: "idle" };

export function CloneClassForm({ classId, name, terms }: { classId: string; name: string; terms: { id: string; name: string }[] }) {
  const { state, formAction, onSubmit, pending } = useActionForm(cloneClass, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(state);
  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="sourceClassId" value={classId} />
      <FormField id="clone-name" label="New class name" error={errors?.name}>
        <Input id="clone-name" name="name" defaultValue={name} />
      </FormField>
      <FormField id="clone-code" label="New class code" error={errors?.code}>
        <Input id="clone-code" name="code" />
      </FormField>
      <FormField id="clone-term" label="Term" error={errors?.termId}>
        <NativeSelect id="clone-term" name="termId" defaultValue="">
          <option value="">No term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </NativeSelect>
      </FormField>
      <div className="grid grid-cols-2 gap-2">
        <FormField id="clone-start" label="Starts" error={errors?.startDate}>
          <Input id="clone-start" name="startDate" type="date" />
        </FormField>
        <FormField id="clone-end" label="Ends" error={errors?.endDate}>
          <Input id="clone-end" name="endDate" type="date" />
        </FormField>
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Duplicating…" : "Duplicate class"}</Button>
      </div>
    </form>
  );
}
