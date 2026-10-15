"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { gradeQuizAnswer } from "@/features/assessment/quiz-actions";

/** Score (and feedback) for one answer. Auto-graded answers can be overridden. */
export function AnswerGrader({
  answerId,
  points,
  score,
  feedback,
  manual,
  label,
}: {
  answerId: string;
  points: number;
  score: number | null;
  feedback: string | null;
  manual: boolean;
  label: string;
}) {
  const [value, setValue] = useState(score === null ? "" : String(score));
  const [comment, setComment] = useState(feedback ?? "");
  const [open, setOpen] = useState(manual);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Adjust score or add feedback</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`score-${answerId}`} className="text-sm font-medium">Score for {label}</label>
        <Input id={`score-${answerId}`} type="number" min={0} max={points} step="0.25" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-24" />
        <span className="text-sm text-muted-foreground">/ {points}</span>
      </div>
      <label htmlFor={`feedback-${answerId}`} className="sr-only">Feedback for {label}</label>
      <Textarea id={`feedback-${answerId}`} rows={2} placeholder="Feedback (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div>
        <Button
          size="sm"
          disabled={pending || value === ""}
          onClick={() =>
            start(async () => {
              const res = await gradeQuizAnswer({ answerId, score: Number(value), feedback: comment });
              if (res.status === "error") toast.error(res.message);
              else if (res.status === "success") toast.success(res.message ?? "Saved.");
            })
          }
        >
          {pending ? "Saving…" : "Save score"}
        </Button>
      </div>
    </div>
  );
}
