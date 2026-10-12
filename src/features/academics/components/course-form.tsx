"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";
import { createCourse, updateCourse } from "../course-actions";
import {
  COURSE_STATUS_LABELS,
  COURSE_STATUSES,
  COURSE_VISIBILITIES,
  COURSE_VISIBILITY_LABELS,
} from "../schemas";

export type CourseFormValues = {
  id?: string;
  code: string;
  title: string;
  summary: string | null;
  description: string | null;
  level: string | null;
  categoryId: string | null;
  status: (typeof COURSE_STATUSES)[number];
  visibility: (typeof COURSE_VISIBILITIES)[number];
  selfEnroll: boolean;
};

const initial: ActionState = { status: "idle" };

export function CourseForm({
  course,
  categories,
}: {
  course?: CourseFormValues;
  categories: { id: string; name: string; depth: number }[];
}) {
  const { state, formAction, onSubmit, pending } = useActionForm(course?.id ? updateCourse : createCourse, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(state, undefined, { toastErrors: false });

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
      {course?.id ? <input type="hidden" name="courseId" value={course.id} /> : null}
      {state.status === "error" && !errors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <FormField id="code" label="Code" error={errors?.code} hint="e.g. MATH-101">
          <Input id="code" name="code" defaultValue={course?.code} />
        </FormField>
        <FormField id="title" label="Title" error={errors?.title}>
          <Input id="title" name="title" defaultValue={course?.title} />
        </FormField>
      </div>
      <FormField id="summary" label="Summary" error={errors?.summary} hint="One or two sentences for course cards.">
        <Input id="summary" name="summary" defaultValue={course?.summary ?? ""} />
      </FormField>
      <FormField id="description" label="Description" error={errors?.description} hint="What students will learn, prerequisites, etc.">
        <Textarea id="description" name="description" rows={6} defaultValue={course?.description ?? ""} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="categoryId" label="Category" error={errors?.categoryId}>
          <NativeSelect id="categoryId" name="categoryId" defaultValue={course?.categoryId ?? ""}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {"— ".repeat(c.depth)}
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="level" label="Level" error={errors?.level} hint="Optional, e.g. Beginner, Grade 7.">
          <Input id="level" name="level" defaultValue={course?.level ?? ""} />
        </FormField>
        <FormField id="status" label="Status" error={errors?.status}>
          <NativeSelect id="status" name="status" defaultValue={course?.status ?? "DRAFT"}>
            {COURSE_STATUSES.map((s) => (
              <option key={s} value={s}>{COURSE_STATUS_LABELS[s]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="visibility" label="Visibility" error={errors?.visibility}>
          <NativeSelect id="visibility" name="visibility" defaultValue={course?.visibility ?? "CATALOG"}>
            {COURSE_VISIBILITIES.map((v) => (
              <option key={v} value={v}>{COURSE_VISIBILITY_LABELS[v]}</option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="selfEnroll" defaultChecked={course?.selfEnroll} className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="font-medium">Allow self-enrollment</span>
          <span className="block text-muted-foreground">Signed-in students can join its active classes from the catalog.</span>
        </span>
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : course?.id ? "Save course" : "Create course"}
        </Button>
      </div>
    </form>
  );
}
