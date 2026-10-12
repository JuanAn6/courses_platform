"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { signIn } from "@/features/auth/actions";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";

const initial: ActionState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const { state, formAction, onSubmit, pending } = useActionForm(signIn, initial);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && !fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id="email" label="Email" error={fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          aria-invalid={!!fieldErrors?.email}
        />
      </FormField>
      <FormField id="password" label="Password" error={fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!fieldErrors?.password}
        />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
