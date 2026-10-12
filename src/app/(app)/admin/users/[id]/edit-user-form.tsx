"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { updateUser } from "@/features/users/actions";
import { RoleCheckboxes } from "@/features/users/components/role-checkboxes";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";
import type { Role } from "@/lib/auth/permissions";

const initial: ActionState = { status: "idle" };

export function EditUserForm({
  user,
}: {
  user: { id: string; name: string; email: string; phone: string; roles: Role[] };
}) {
  const { state, formAction, onSubmit, pending } = useActionForm(updateUser, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
    else if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="userId" value={user.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="name" label="Full name" error={errors?.name}>
          <Input id="name" name="name" defaultValue={user.name} />
        </FormField>
        <FormField id="email" label="Email" error={errors?.email}>
          <Input id="email" name="email" type="email" defaultValue={user.email} />
        </FormField>
        <FormField id="phone" label="Phone" error={errors?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={user.phone} />
        </FormField>
      </div>
      <RoleCheckboxes defaultRoles={user.roles} error={errors?.roles} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
