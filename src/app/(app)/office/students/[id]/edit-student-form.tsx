"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateStudent } from "@/features/students/actions";
import { StudentFields, type StudentDefaults } from "@/features/students/components/student-fields";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";

const initial: ActionState = { status: "idle" };

export function EditStudentForm({ userId, defaults }: { userId: string; defaults: StudentDefaults }) {
  const { state, formAction, onSubmit, pending } = useActionForm(updateStudent, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
    else if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-6" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <StudentFields defaults={defaults} errors={errors} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save record"}
        </Button>
      </div>
    </form>
  );
}
