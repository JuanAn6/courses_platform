"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { updateSettings } from "@/features/settings/actions";
import type { Settings } from "@/features/settings/schemas";
import type { ActionState } from "@/lib/actions";

type Defaults = Settings<"general"> & Settings<"academic"> & Settings<"messaging">;

const initial: ActionState = { status: "idle" };

export function SettingsForm({ defaults, timeZones }: { defaults: Defaults; timeZones: string[] }) {
  const [state, formAction, pending] = useActionState(updateSettings, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
    else if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid max-w-2xl gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>How the institution appears across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField id="institutionName" label="Institution name" error={errors?.institutionName}>
            <Input id="institutionName" name="institutionName" defaultValue={defaults.institutionName} required />
          </FormField>
          <FormField id="contactEmail" label="Contact email" error={errors?.contactEmail} hint="Optional.">
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaults.contactEmail} />
          </FormField>
          <FormField
            id="timezone"
            label="Time zone"
            error={errors?.timezone}
            hint="Dates and deadlines are shown in this time zone."
          >
            <Input id="timezone" name="timezone" list="timezones" defaultValue={defaults.timezone} required />
            <datalist id="timezones">
              {timeZones.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic</CardTitle>
          <CardDescription>Defaults applied to classes and certificates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField
            id="passingScore"
            label="Passing score (%)"
            error={errors?.passingScore}
            hint="Minimum final grade to pass a class and earn a certificate."
          >
            <Input
              id="passingScore"
              name="passingScore"
              type="number"
              min={0}
              max={100}
              defaultValue={defaults.passingScore}
              className="w-28"
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messaging</CardTitle>
          <CardDescription>Who can start conversations with whom.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="allowStudentToStudent"
              defaultChecked={defaults.allowStudentToStudent}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">Allow students to message each other</span>
              <span className="block text-muted-foreground">
                Students can always message the teachers of their classes.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
