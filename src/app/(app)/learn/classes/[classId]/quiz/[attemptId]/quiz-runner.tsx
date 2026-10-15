"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { QuestionInput } from "@/features/assessment/components/question-input";
import { saveQuizAnswers, submitQuiz } from "@/features/assessment/quiz-actions";
import type { StudentQuestionView } from "@/features/assessment/questions";
import { cn } from "@/lib/utils";

type Question = {
  questionId: string;
  points: number;
  view: StudentQuestionView;
  response: Record<string, unknown>;
  prompt: React.ReactNode;
};

const AUTOSAVE_MS = 15_000;

function answered(view: StudentQuestionView, r: Record<string, unknown>) {
  switch (view.type) {
    case "SINGLE_CHOICE":
      return r.choice != null;
    case "MULTIPLE_CHOICE":
      return ((r.choices as unknown[]) ?? []).length > 0;
    case "TRUE_FALSE":
      return r.value != null;
    case "SHORT_ANSWER":
    case "ESSAY":
      return !!String(r.text ?? "").trim();
    case "NUMERIC":
      return !!String(r.value ?? "").trim();
    case "MATCHING":
      return Object.values((r.matches as Record<string, string>) ?? {}).some(Boolean);
    case "ORDERING":
      return ((r.order as unknown[]) ?? []).length > 0;
    case "FILL_BLANKS":
      return ((r.blanks as string[]) ?? []).some((b) => b.trim());
    case "FILE_UPLOAD":
      return ((r.fileIds as unknown[]) ?? []).length > 0;
  }
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function QuizRunner({
  attemptId,
  title,
  number,
  deadline,
  serverNow,
  onePerPage,
  questions,
  fileNames: initialFileNames,
}: {
  attemptId: string;
  title: string;
  number: number;
  deadline: string | null;
  serverNow: string;
  onePerPage: boolean;
  questions: Question[];
  fileNames: Record<string, string>;
}) {
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(questions.map((q) => [q.questionId, q.response])),
  );
  const [fileNames, setFileNames] = useState(initialFileNames);
  const dirty = useRef<Set<string>>(new Set());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const router = useRouter();
  const autoSubmitted = useRef(false);

  // Clock skew between this browser and the server, so the countdown matches server enforcement.
  const [skew] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [remaining, setRemaining] = useState<number | null>(() => (deadline ? new Date(deadline).getTime() - (Date.now() + skew) : null));

  const pendingAnswers = useCallback(() => {
    const ids = [...dirty.current];
    return ids.map((questionId) => ({ questionId, response: responses[questionId] }));
  }, [responses]);

  const save = useCallback(async () => {
    const answers = pendingAnswers();
    if (!answers.length) return;
    dirty.current.clear();
    const res = await saveQuizAnswers({ attemptId, answers });
    if (res.status === "success" && res.data) setSavedAt(new Date(res.data.savedAt).toLocaleTimeString());
    else if (res.status === "error") {
      answers.forEach((a) => dirty.current.add(a.questionId));
      toast.error(res.message);
    }
  }, [attemptId, pendingAnswers]);

  const submit = useCallback(
    () =>
      startSubmit(async () => {
        const all = questions.map((q) => ({ questionId: q.questionId, response: responses[q.questionId] }));
        dirty.current.clear();
        const res = await submitQuiz({ attemptId, answers: all });
        if (res.status === "error") toast.error(res.message);
        else if (res.status === "success" && res.data) {
          autoSubmitted.current = true; // no "unsaved changes" prompt while leaving
          router.push(res.data.url);
        }
      }),
    [attemptId, questions, responses, router],
  );

  // Autosave.
  useEffect(() => {
    const timer = setInterval(() => void save(), AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [save]);

  // Countdown; submit automatically at zero.
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      const left = new Date(deadline).getTime() - (Date.now() + skew);
      setRemaining(left);
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        toast.info("Time is up. Submitting your answers…");
        submit();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, skew, submit]);

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current.size && !autoSubmitted.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const update = (questionId: string, value: Record<string, unknown>) => {
    dirty.current.add(questionId);
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const unanswered = questions.filter((q) => !answered(q.view, responses[q.questionId])).length;
  const visible = onePerPage ? [questions[page]] : questions;
  const lowTime = remaining !== null && remaining < 60_000;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Attempt {number} · {questions.length - unanswered}/{questions.length} answered
            {savedAt ? ` · Saved ${savedAt}` : ""}
          </p>
        </div>
        {remaining !== null ? (
          <p className={cn("flex items-center gap-1 rounded-md border px-3 py-1 font-mono text-sm tabular-nums", lowTime && "border-destructive text-destructive")} role="timer" aria-label="Time remaining">
            <Clock className="size-4" aria-hidden /> {formatRemaining(remaining)}
          </p>
        ) : null}
      </div>

      {onePerPage ? (
        <nav aria-label="Questions" className="flex flex-wrap gap-1">
          {questions.map((q, i) => (
            <button
              key={q.questionId}
              type="button"
              onClick={() => setPage(i)}
              aria-current={i === page ? "step" : undefined}
              aria-label={`Question ${i + 1}${answered(q.view, responses[q.questionId]) ? ", answered" : ""}`}
              className={cn(
                "size-8 rounded-md border text-sm tabular-nums",
                i === page && "border-primary ring-2 ring-primary/30",
                answered(q.view, responses[q.questionId]) && "bg-primary/10",
              )}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      ) : null}

      {visible.map((q) => {
        const index = questions.indexOf(q);
        return (
          <Card key={q.questionId} aria-labelledby={`q-${q.questionId}`}>
            <CardHeader>
              <h2 id={`q-${q.questionId}`} className="flex justify-between text-sm font-medium text-muted-foreground">
                <span>Question {index + 1}</span>
                <span className="tabular-nums">{q.points} pt{q.points === 1 ? "" : "s"}</span>
              </h2>
            </CardHeader>
            <CardContent className="grid gap-4">
              {q.prompt}
              <QuestionInput
                name={q.questionId}
                view={q.view}
                value={responses[q.questionId] ?? {}}
                onChange={(v) => update(q.questionId, v)}
                disabled={submitting}
                fileNames={fileNames}
                onFileName={(id, name) => setFileNames((prev) => ({ ...prev, [id]: name }))}
              />
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {onePerPage ? (
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => { void save(); setPage(page - 1); }}><ChevronLeft /> Previous</Button>
            <Button variant="outline" disabled={page === questions.length - 1} onClick={() => { void save(); setPage(page + 1); }}>Next <ChevronRight /></Button>
          </div>
        ) : <span />}
        <ConfirmButton
          variant="default"
          disabled={submitting}
          run={async () => {
            submit();
            return { status: "success" as const };
          }}
          label={<><Send /> {submitting ? "Submitting…" : "Submit quiz"}</>}
          title="Submit your answers?"
          description={unanswered ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered. You can't change your answers after submitting.` : "You can't change your answers after submitting."}
          confirmLabel="Submit"
        />
      </div>
    </div>
  );
}
