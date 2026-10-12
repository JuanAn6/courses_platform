"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkDelivery } from "@/components/copy-link";
import { createStudent, type CreateStudentData } from "@/features/students/actions";
import { StudentFields } from "@/features/students/components/student-fields";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";

const initial: ActionState<CreateStudentData> = { status: "idle" };

export function NewStudentForm() {
  const { state, formAction, onSubmit, pending } = useActionForm(createStudent, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  // The result card stays until dismissed; a new submission produces a new state object.
  const [dismissed, setDismissed] = useState<ActionState<CreateStudentData> | null>(null);

  if (state.status === "success" && state.data && state !== dismissed) {
    const { userId, invite } = state.data;
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> Student added
          </CardTitle>
          <CardDescription>
            {invite ? "They can activate their account with the invite link." : "No invite was sent yet. You can send one from their record."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {invite ? <LinkDelivery url={invite.url} delivered={invite.delivered} kind="invite" /> : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/office/students/${userId}`}>Open student record</Link>
            </Button>
            <Button variant="outline" onClick={() => setDismissed(state)}>
              Add another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid max-w-3xl gap-6" noValidate>
      <Card>
        <CardContent className="grid gap-6">
          {state.status === "error" && !errors ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <StudentFields errors={errors} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sendInvite" defaultChecked className="size-4 accent-primary" />
            Send the student an invite link now
          </label>
        </CardContent>
      </Card>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add student"}
        </Button>
      </div>
    </form>
  );
}
