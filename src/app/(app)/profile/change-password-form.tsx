"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { changePassword } from "@/features/auth/actions";
import type { ActionState } from "@/lib/actions";

const initial: ActionState = { status: "idle" };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Password changed.");
      formRef.current?.reset();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <FormField id="currentPassword" label="Current password" error={fieldErrors?.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </FormField>
      <FormField
        id="newPassword"
        label="New password"
        error={fieldErrors?.newPassword}
        hint="At least 8 characters."
      >
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password" error={fieldErrors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
