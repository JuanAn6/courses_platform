"use client";

import { useRef, useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { addCourseEditor, cloneCourse, removeCourseEditor, uploadCourseCover } from "@/features/academics/course-actions";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";

const initial: ActionState = { status: "idle" };

export function CoverForm({ courseId, hasCover }: { courseId: string; hasCover: boolean }) {
  const { state, formAction, onSubmit, pending } = useActionForm(uploadCourseCover, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(state, () => formRef.current?.reset());

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <FormField id="cover" label={hasCover ? "Replace cover image" : "Cover image"} error={errors?.cover} hint="JPEG, PNG or WebP, up to 5 MB. 16:9 works best.">
        <Input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
      </FormField>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
      </div>
    </form>
  );
}

type Person = { id: string; name: string; email: string };

export function EditorsPanel({ courseId, editors, teachers }: { courseId: string; editors: Person[]; teachers: Person[] }) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const available = teachers.filter((t) => !editors.some((e) => e.id === t.id));

  return (
    <div className="grid gap-3">
      {editors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No editors yet. Administrators can always edit.</p>
      ) : (
        <ul className="divide-y">
          {editors.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                {e.name}
                <span className="block text-xs text-muted-foreground">{e.email}</span>
              </span>
              <ConfirmButton
                variant="ghost"
                run={() => removeCourseEditor({ courseId, userId: e.id })}
                label={<><UserMinus /><span className="sr-only">Remove {e.name}</span></>}
                title={`Remove ${e.name} as editor?`}
                description="They keep teaching any classes they're assigned to."
                confirmLabel="Remove"
                destructive
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <label htmlFor="editor-select" className="sr-only">Teacher</label>
        <NativeSelect id="editor-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a teacher…</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </NativeSelect>
        <Button
          variant="outline"
          disabled={!selected || pending}
          onClick={() =>
            startTransition(async () => {
              const res = await addCourseEditor({ courseId, userId: selected });
              if (res.status === "error") toast.error(res.message);
              else if (res.status === "success") {
                toast.success(res.message ?? "Added.");
                setSelected("");
              }
            })
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function CloneCourseForm({ courseId, title }: { courseId: string; title: string }) {
  const { state, formAction, onSubmit, pending } = useActionForm(cloneCourse, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(state);
  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="sourceCourseId" value={courseId} />
      <FormField id="clone-title" label="New title" error={errors?.title}>
        <Input id="clone-title" name="title" defaultValue={`${title} (copy)`} />
      </FormField>
      <FormField id="clone-code" label="New code" error={errors?.code}>
        <Input id="clone-code" name="code" />
      </FormField>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Duplicating…" : "Duplicate course"}</Button>
      </div>
    </form>
  );
}
