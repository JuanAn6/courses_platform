"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LinkDelivery } from "@/components/copy-link";
import { FormField } from "@/components/form-field";
import { inviteUser, type InviteUserData } from "@/features/users/actions";
import { RoleCheckboxes } from "@/features/users/components/role-checkboxes";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";

const initial: ActionState<InviteUserData> = { status: "idle" };

export function InviteUserForm() {
  const { state, formAction, onSubmit, pending } = useActionForm(inviteUser, initial);
  // The result card stays until dismissed; a new submission produces a new state object.
  const [dismissed, setDismissed] = useState<ActionState<InviteUserData> | null>(null);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "success" && state.data && state !== dismissed) {
    const { userId, invite } = state.data;
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> User created
          </CardTitle>
          <CardDescription>
            {invite ? "They can activate their account with the invite link." : "No invite was sent. You can send one from their page."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {invite ? <LinkDelivery url={invite.url} delivered={invite.delivered} kind="invite" /> : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/admin/users/${userId}`}>View user</Link>
            </Button>
            <Button variant="outline" onClick={() => setDismissed(state)}>
              Invite another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid max-w-2xl gap-6" noValidate>
      <Card>
        <CardContent className="grid gap-4">
          {state.status === "error" && !errors ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <FormField id="name" label="Full name" error={errors?.name}>
            <Input id="name" name="name" autoComplete="off" required />
          </FormField>
          <FormField id="email" label="Email" error={errors?.email}>
            <Input id="email" name="email" type="email" autoComplete="off" required />
          </FormField>
          <FormField id="phone" label="Phone" error={errors?.phone} hint="Optional.">
            <Input id="phone" name="phone" type="tel" autoComplete="off" />
          </FormField>
          <RoleCheckboxes error={errors?.roles} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sendInvite" defaultChecked className="size-4 accent-primary" />
            Send an invite link now
          </label>
        </CardContent>
      </Card>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
