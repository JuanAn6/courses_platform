"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { setPassword } from "@/features/accounts/actions";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";

const initial: ActionState = { status: "idle" };

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const { state, formAction, onSubmit, pending } = useActionForm(setPassword, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {/* Helps password managers save the right username. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      {state.status === "error" && !errors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id="password" label="New password" error={errors?.password} hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" autoFocus />
      </FormField>
      <FormField id="confirmPassword" label="Confirm password" error={errors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set password and sign in"}
      </Button>
    </form>
  );
}
