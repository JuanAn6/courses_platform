import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { loadAttemptForStudent } from "@/features/assessment/attempt-view";
import { ReadOnlyAnswer } from "@/features/assessment/components/read-only-answer";
import { correctAnswerText, QUESTION_TYPE_INFO } from "@/features/assessment/questions";
import { canGradeClass } from "@/features/assessment/student-access";
import { RichTextView } from "@/features/entries/rich-text/rich-text-view";
import { getSettings } from "@/features/settings/queries";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { AnswerGrader } from "./answer-grader";

export const metadata: Metadata = { title: "Grade quiz attempt" };

export default async function GradeAttemptPage({ params }: PageProps<"/teach/grading/attempts/[attemptId]">) {
  const user = await requireArea("teach");
  const { attemptId } = await params;
  const data = await loadAttemptForStudent(attemptId);
  if (!data) notFound();
  const { attempt, items, fileNames } = data;
  if (!(await canGradeClass(user, attempt.classId))) redirect("/forbidden");
  const [student, klass, { timezone }] = await Promise.all([
    db.user.findUnique({ where: { id: attempt.userId }, select: { name: true } }),
    db.class.findUnique({ where: { id: attempt.classId }, select: { name: true } }),
    getSettings("general"),
  ]);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/teach/classes/${attempt.classId}/assessments/${attempt.entryId}`}><ArrowLeft /> {attempt.entry.title}</Link>
        </Button>
        <PageHeader
          title={`${student?.name ?? "Student"} · ${attempt.entry.title}`}
          description={`${klass?.name} · Attempt ${attempt.number}${attempt.submittedAt ? ` · Submitted ${formatDateTime(attempt.submittedAt, timezone)}` : ""}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{attempt.status === "GRADED" ? "Graded" : attempt.status === "NEEDS_GRADING" ? "Needs grading" : "In progress"}</Badge>
          <span className="text-sm tabular-nums">Score: {attempt.score ?? "—"} / {attempt.maxScore}</span>
        </div>
      </div>

      {items.map((item, i) => {
        const manual = QUESTION_TYPE_INFO[item.type].manual;
        const correct = manual ? null : correctAnswerText(item.type, item.data);
        return (
          <Card key={item.questionId}>
            <CardHeader>
              <h2 className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>Question {i + 1} · {QUESTION_TYPE_INFO[item.type].label}</span>
                <span className="tabular-nums">{item.score ?? "—"} / {item.points}</span>
              </h2>
            </CardHeader>
            <CardContent className="grid gap-4">
              <RichTextView doc={item.prompt} />
              <ReadOnlyAnswer view={item.view} response={item.response} fileNames={fileNames} />
              {correct ? <p className="text-sm"><span className="font-medium">Correct answer: </span>{correct}</p> : null}
              {item.answerId && attempt.status !== "IN_PROGRESS" ? (
                <AnswerGrader
                  answerId={item.answerId}
                  points={item.points}
                  score={item.score}
                  feedback={item.feedback}
                  manual={manual}
                  label={`question ${i + 1}`}
                />
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
