import "server-only";
import { db } from "@/lib/db";
import { parseContent } from "@/features/entries/registry";
import { studentView, type QuestionType } from "./questions";
import type { Snapshot } from "./quiz-service";

/** An attempt with each question's student view (answers stripped) and the student's responses. */
export async function loadAttemptForStudent(attemptId: string) {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: { include: { files: { include: { file: { select: { id: true, originalName: true } } } } } },
      entry: { select: { id: true, title: true, content: true, unitId: true } },
    },
  });
  if (!attempt) return null;
  const { settings } = parseContent("QUIZ", attempt.entry.content);
  const answers = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const fileNames: Record<string, string> = {};
  for (const a of attempt.answers) for (const f of a.files) fileNames[f.file.id] = f.file.originalName;

  const items = (attempt.snapshot as unknown as Snapshot).items.map((item) => {
    const answer = answers.get(item.questionId);
    return {
      questionId: item.questionId,
      type: item.type as QuestionType,
      prompt: item.prompt,
      points: item.points,
      view: studentView(item.type, item.data, `${attempt.id}:${item.questionId}`, settings.shuffleOptions),
      response: (answer?.response ?? {}) as Record<string, unknown>,
      // The fields below are for results pages only; never send them to an in-progress runner.
      data: item.data,
      explanation: item.explanation,
      score: answer ? (answer.manualScore ?? answer.autoScore) : null,
      feedback: answer?.feedback ?? null,
      answerId: answer?.id ?? null,
    };
  });
  return { attempt, settings, items, fileNames };
}
