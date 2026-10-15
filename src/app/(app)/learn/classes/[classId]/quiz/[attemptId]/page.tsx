import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireClassViewer } from "@/features/academics/access";
import { loadAttemptForStudent } from "@/features/assessment/attempt-view";
import { attemptAcceptsAnswers, submitAttempt } from "@/features/assessment/quiz-service";
import { RichTextView } from "@/features/entries/rich-text/rich-text-view";
import { QuizRunner } from "./quiz-runner";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizAttemptPage({ params }: PageProps<"/learn/classes/[classId]/quiz/[attemptId]">) {
  const { classId, attemptId } = await params;
  const { user } = await requireClassViewer(classId);
  const data = await loadAttemptForStudent(attemptId);
  if (!data || data.attempt.userId !== user.id || data.attempt.classId !== classId) notFound();
  const { attempt, settings, items, fileNames } = data;

  if (attempt.status === "IN_PROGRESS" && !attemptAcceptsAnswers(attempt)) await submitAttempt(attempt.id);
  if (attempt.status !== "IN_PROGRESS" || !attemptAcceptsAnswers(attempt)) {
    redirect(`/learn/classes/${classId}/quiz/${attemptId}/results`);
  }

  return (
    <QuizRunner
      attemptId={attempt.id}
      title={attempt.entry.title}
      number={attempt.number}
      deadline={attempt.deadlineAt?.toISOString() ?? null}
      serverNow={new Date().toISOString()}
      onePerPage={settings.onePerPage}
      fileNames={fileNames}
      // Only what's needed to answer: the student view, never `data`/answers.
      questions={items.map((i) => ({
        questionId: i.questionId,
        points: i.points,
        view: i.view,
        response: i.response,
        prompt: <RichTextView doc={i.prompt} />,
      }))}
    />
  );
}
