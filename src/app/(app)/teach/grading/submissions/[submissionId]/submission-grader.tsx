"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { gradeSubmission } from "@/features/assessment/assignment-actions";
import { rubricScore, type Rubric } from "@/features/assessment/rubric";
import { cn } from "@/lib/utils";

export function SubmissionGrader({
  submissionId,
  rubric,
  maxScore,
  initial,
}: {
  submissionId: string;
  rubric: Rubric | null;
  maxScore: number;
  initial: { score: number | null; rubric: Record<string, string>; feedback: string; released: boolean };
}) {
  const [selections, setSelections] = useState(initial.rubric);
  const [score, setScore] = useState(initial.score === null ? "" : String(initial.score));
  const [feedback, setFeedback] = useState(initial.feedback);
  const [release, setRelease] = useState(initial.released);
  const [pending, start] = useTransition();
  const rubricResult = rubric ? rubricScore(rubric, selections) : null;

  return (
    <div className="grid gap-4">
      {rubric ? (
        <div className="grid gap-4">
          {rubric.criteria.map((c) => (
            <fieldset key={c.id} className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium">{c.title}</legend>
              {c.levels.map((l) => (
                <label key={l.id} className={cn("flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm", selections[c.id] === l.id && "border-primary bg-accent/50")}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name={`criterion-${c.id}`} checked={selections[c.id] === l.id} onChange={() => setSelections({ ...selections, [c.id]: l.id })} className="accent-primary" />
                    {l.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{l.points}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <p className="text-sm font-medium tabular-nums">
            Total: {rubricResult?.score ?? 0} / {maxScore}
            {!rubricResult?.complete ? <span className="ml-2 font-normal text-muted-foreground">(choose a level for each criterion)</span> : null}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <label htmlFor="grade-score" className="text-sm font-medium">Score</label>
          <Input id="grade-score" type="number" min={0} max={maxScore} step="0.25" className="w-24" value={score} onChange={(e) => setScore(e.target.value)} />
          <span className="text-sm text-muted-foreground">/ {maxScore}</span>
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor="grade-feedback" className="text-sm font-medium">Feedback</label>
        <Textarea id="grade-feedback" rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} className="size-4 accent-primary" />
        Release to the student now
      </label>
      <Button
        disabled={pending || (rubric ? !rubricResult?.complete : score === "")}
        onClick={() =>
          start(async () => {
            const res = await gradeSubmission({
              submissionId,
              score: rubric ? null : Number(score),
              rubric: rubric ? selections : null,
              feedback,
              release,
            });
            if (res.status === "error") toast.error(res.message);
            else if (res.status === "success") toast.success(res.message ?? "Saved.");
          })
        }
      >
        {pending ? "Saving…" : "Save grade"}
      </Button>
    </div>
  );
}
