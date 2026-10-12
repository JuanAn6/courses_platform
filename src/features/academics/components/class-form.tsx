"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";
import { toDateInput } from "@/lib/zod";
import { createClass, updateClass } from "../class-actions";
import { BOARD_POLICIES, BOARD_POLICY_LABELS, CLASS_STATUS_LABELS, CLASS_STATUSES } from "../schemas";

export type ClassFormValues = {
  id?: string;
  courseId: string;
  termId: string | null;
  name: string;
  code: string;
  startDate: Date | null;
  endDate: Date | null;
  capacity: number | null;
  status: (typeof CLASS_STATUSES)[number];
  boardPolicy: (typeof BOARD_POLICIES)[number];
};

const initial: ActionState = { status: "idle" };

export function ClassForm({
  klass,
  defaultCourseId,
  courses,
  terms,
}: {
  klass?: ClassFormValues;
  defaultCourseId?: string;
  courses: { id: string; code: string; title: string }[];
  terms: { id: string; name: string }[];
}) {
  const { state, formAction, onSubmit, pending } = useActionForm(klass?.id ? updateClass : createClass, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(state, undefined, { toastErrors: false });

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
      {klass?.id ? <input type="hidden" name="classId" value={klass.id} /> : null}
      {state.status === "error" && !errors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="courseId" label="Course" error={errors?.courseId}>
          <NativeSelect id="courseId" name="courseId" defaultValue={klass?.courseId ?? defaultCourseId ?? ""}>
            <option value="">Choose a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title} ({c.code})</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="termId" label="Term" error={errors?.termId}>
          <NativeSelect id="termId" name="termId" defaultValue={klass?.termId ?? ""}>
            <option value="">No term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="name" label="Class name" error={errors?.name} hint="e.g. Algebra I · Group A">
          <Input id="name" name="name" defaultValue={klass?.name} />
        </FormField>
        <FormField id="code" label="Class code" error={errors?.code} hint="e.g. MATH-101-26F-A">
          <Input id="code" name="code" defaultValue={klass?.code} />
        </FormField>
        <FormField id="startDate" label="Starts" error={errors?.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={toDateInput(klass?.startDate)} />
        </FormField>
        <FormField id="endDate" label="Ends" error={errors?.endDate}>
          <Input id="endDate" name="endDate" type="date" defaultValue={toDateInput(klass?.endDate)} />
        </FormField>
        <FormField id="capacity" label="Capacity" error={errors?.capacity} hint="Leave empty for no limit.">
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={klass?.capacity ?? ""} />
        </FormField>
        <FormField id="status" label="Status" error={errors?.status} hint="Students only see Active and Completed classes.">
          <NativeSelect id="status" name="status" defaultValue={klass?.status ?? "DRAFT"}>
            {CLASS_STATUSES.map((s) => (
              <option key={s} value={s}>{CLASS_STATUS_LABELS[s]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="boardPolicy" label="Class board" error={errors?.boardPolicy}>
          <NativeSelect id="boardPolicy" name="boardPolicy" defaultValue={klass?.boardPolicy ?? "STUDENTS_CAN_POST"}>
            {BOARD_POLICIES.map((p) => (
              <option key={p} value={p}>{BOARD_POLICY_LABELS[p]}</option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : klass?.id ? "Save class" : "Create class"}
        </Button>
      </div>
    </form>
  );
}
