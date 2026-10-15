"use client";

import { useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteQuestion, duplicateQuestion } from "@/features/assessment/question-actions";

export function QuestionRowActions({ questionId, label }: { questionId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={`Duplicate “${label}”`}
        onClick={() =>
          start(async () => {
            const res = await duplicateQuestion({ questionId });
            if (res.status === "error") toast.error(res.message);
            else if (res.status === "success" && res.message) toast.success(res.message);
          })
        }
      >
        <Copy />
      </Button>
      <ConfirmButton
        variant="ghost"
        run={() => deleteQuestion({ questionId })}
        label={<><Trash2 /><span className="sr-only">Delete “{label}”</span></>}
        title="Delete this question?"
        description="Quizzes that include it will skip it from now on. Past attempts keep their copy."
        confirmLabel="Delete"
        destructive
      />
    </span>
  );
}
