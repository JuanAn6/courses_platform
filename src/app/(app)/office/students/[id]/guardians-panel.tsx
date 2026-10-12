"use client";

import { useEffect, useRef, useState } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { LinkDelivery } from "@/components/copy-link";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { UserStatusBadge } from "@/components/status-badges";
import { linkGuardian, unlinkGuardian, type LinkGuardianData } from "@/features/students/actions";
import { RELATIONSHIPS } from "@/features/students/schemas";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";

type Guardian = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  relationship: string;
};

const initial: ActionState<LinkGuardianData> = { status: "idle" };

export function GuardiansPanel({ studentId, guardians }: { studentId: string; guardians: Guardian[] }) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Guardians</CardTitle>
          <CardDescription>Guardians can follow this student&apos;s progress, grades and attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          {guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guardians linked yet.</p>
          ) : (
            <ul className="divide-y">
              {guardians.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {g.name} <span className="font-normal text-muted-foreground">· {g.relationship}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {g.email}
                      {g.phone ? ` · ${g.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserStatusBadge status={g.status} />
                    <ConfirmButton
                      run={() => unlinkGuardian({ studentId, guardianId: g.id })}
                      label={<><UserMinus /> Unlink</>}
                      title={`Unlink ${g.name}?`}
                      description="They will no longer see this student. Their account is kept."
                      confirmLabel="Unlink"
                      destructive
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <AddGuardianCard studentId={studentId} />
    </div>
  );
}

function AddGuardianCard({ studentId }: { studentId: string }) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const { state, formAction, onSubmit, pending } = useActionForm(linkGuardian, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Guardian linked.");
      formRef.current?.reset();
    }
    else if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a guardian</CardTitle>
        <CardDescription>Create a new guardian account or link someone who already has one.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {state.status === "success" && state.data?.invite ? (
          <LinkDelivery url={state.data.invite.url} delivered={state.data.invite.delivered} kind="invite" />
        ) : null}
        <div role="radiogroup" aria-label="Guardian account" className="flex gap-4 text-sm">
          {(["new", "existing"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="guardian-mode" checked={mode === m} onChange={() => setMode(m)} className="accent-primary" />
              {m === "new" ? "New guardian" : "Existing account"}
            </label>
          ))}
        </div>
        <form key={mode} ref={formRef} action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="studentId" value={studentId} />
          {state.status === "error" && !errors ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "new" ? (
              <FormField id="guardian-name" label="Guardian name" error={errors?.name}>
                <Input id="guardian-name" name="name" autoComplete="off" />
              </FormField>
            ) : null}
            <FormField id="guardian-email" label="Guardian email" error={errors?.email}>
              <Input id="guardian-email" name="email" type="email" autoComplete="off" />
            </FormField>
            {mode === "new" ? (
              <FormField id="guardian-phone" label="Guardian phone" error={errors?.phone}>
                <Input id="guardian-phone" name="phone" type="tel" autoComplete="off" />
              </FormField>
            ) : null}
            <FormField id="guardian-relationship" label="Relationship" error={errors?.relationship}>
              <NativeSelect id="guardian-relationship" name="relationship" defaultValue="Parent">
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          {mode === "new" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="sendInvite" defaultChecked className="size-4 accent-primary" />
              Send the guardian an invite link now
            </label>
          ) : null}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "new" ? "Create and link guardian" : "Link guardian"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
