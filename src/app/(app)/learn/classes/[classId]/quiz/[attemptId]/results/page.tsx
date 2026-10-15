import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireClassViewer } from "@/features/academics/access";
import { loadAttemptForStudent } from "@/features/assessment/attempt-view";
import { ReadOnlyAnswer } from "@/features/assessment/components/read-only-answer";
import { canSeeResults, passed } from "@/features/assessment/quiz";
import { correctAnswerText, QUESTION_TYPE_INFO } from "@/features/assessment/questions";
import { findEntry } from "@/features/entries/outline";
import { getStudentOutline } from "@/features/entries/queries";
import { RichTextView } from "@/features/entries/rich-text/rich-text-view";

export const metadata: Metadata = { title: "Quiz results" };

export default async function QuizResultsPage({ params }: PageProps<"/learn/classes/[classId]/quiz/[attemptId]/results">) {
  const { classId, attemptId } = await params;
  const { user, klass } = await requireClassViewer(classId);
  const data = await loadAttemptForStudent(attemptId);
  if (!data || data.attempt.userId !== user.id || data.attempt.classId !== classId) notFound();
  const { attempt, settings, items, fileNames } = data;
  if (attempt.status === "IN_PROGRESS") redirect(`/learn/classes/${classId}/quiz/${attemptId}`);

  const outline = await getStudentOutline(classId, klass.courseId, user.id);
  const dueAt = findEntry(outline, attempt.entryId)?.entry.dueAt ?? null;
  const visible = canSeeResults(settings, dueAt, new Date());
  const back = `/learn/classes/${classId}/entries/${attempt.entryId}`;
  const didPass = attempt.status === "GRADED" ? passed(attempt.score, attempt.maxScore, settings) : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={back}><ArrowLeft /> {attempt.entry.title}</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Attempt {attempt.number} submitted</h1>
      </div>

      {!visible ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {settings.showResults === "after_due" ? "Results will be available after the due date." : "Your teacher will share the results through your grades."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {attempt.score ?? 0} <span className="text-lg text-muted-foreground">/ {attempt.maxScore}</span>
                </p>
              </div>
              {attempt.status === "NEEDS_GRADING" ? (
                <Badge variant="secondary">Some answers are waiting for your teacher</Badge>
              ) : didPass === true ? (
                <Badge className="bg-emerald-600">Passed</Badge>
              ) : didPass === false ? (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive">Not passed</Badge>
              ) : null}
            </CardContent>
          </Card>

          {items.map((item, i) => {
            const manual = QUESTION_TYPE_INFO[item.type].manual;
            const full = item.score !== null && item.score >= item.points;
            const icon =
              item.score === null ? <CircleAlert className="size-4 text-muted-foreground" aria-label="Awaiting grading" /> :
              full ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="Correct" /> :
              item.score > 0 ? <CircleAlert className="size-4 text-amber-600" aria-label="Partly correct" /> :
              <XCircle className="size-4 text-destructive" aria-label="Incorrect" />;
            const correct = settings.showCorrectAnswers && !manual ? correctAnswerText(item.type, item.data) : null;
            return (
              <Card key={item.questionId}>
                <CardHeader>
                  <h2 className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    <span className="flex items-center gap-2">{icon} Question {i + 1}</span>
                    <span className="tabular-nums">{item.score === null ? "—" : item.score} / {item.points}</span>
                  </h2>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <RichTextView doc={item.prompt} />
                  <ReadOnlyAnswer view={item.view} response={item.response} fileNames={fileNames} />
                  {correct && !full ? (
                    <p className="text-sm"><span className="font-medium">Correct answer: </span>{correct}</p>
                  ) : null}
                  {settings.showCorrectAnswers && item.explanation ? (
                    <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm">{item.explanation}</p>
                  ) : null}
                  {item.feedback ? (
                    <p className="whitespace-pre-line rounded-md border p-3 text-sm"><span className="font-medium">Teacher feedback: </span>{item.feedback}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      <div>
        <Button variant="outline" asChild>
          <Link href={back}>Back to the quiz</Link>
        </Button>
      </div>
    </div>
  );
}
