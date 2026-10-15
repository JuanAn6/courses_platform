"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { command, ForbiddenError, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { attemptAcceptsAnswers, gradeAnswer, saveResponses, startAttempt, submitAttempt } from "./quiz-service";
import { requireClassGrader, requireStudentEntry } from "./student-access";

/** Where to go next. Returned instead of redirect(): these run inside client transitions. */
export type NavigateResult = { url: string };

const answersSchema = z.array(z.object({ questionId: z.string().min(1).max(40), response: z.unknown() })).max(200);

export const startQuiz = command(
  { schema: z.object({ classId: z.string().min(1), entryId: z.string().min(1) }) },
  async ({ classId, entryId }, user) => {
    const { dueAt } = await requireStudentEntry(user, classId, entryId);
    const attemptId = await startAttempt({ entryId, classId, userId: user.id, dueAt });
    return { status: "success", data: { url: `/learn/classes/${classId}/quiz/${attemptId}` } } satisfies ActionState<NavigateResult>;
  },
);

async function loadOwnAttempt(userId: string, attemptId: string) {
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) throw new ForbiddenError();
  return attempt;
}

export type SaveResult = { savedAt: string };

/** Autosave. Fails once the deadline (plus grace) has passed. */
export const saveQuizAnswers = command(
  { schema: z.object({ attemptId: z.string().min(1), answers: answersSchema }) },
  async ({ attemptId, answers }, user) => {
    const attempt = await loadOwnAttempt(user.id, attemptId);
    if (!attemptAcceptsAnswers(attempt)) throw new UserError("Time is up: this attempt has been submitted.");
    await saveResponses(attemptId, answers);
    return { status: "success", data: { savedAt: new Date().toISOString() } } satisfies ActionState<SaveResult>;
  },
);

export const submitQuiz = command(
  { schema: z.object({ attemptId: z.string().min(1), answers: answersSchema }) },
  async ({ attemptId, answers }, user) => {
    const attempt = await loadOwnAttempt(user.id, attemptId);
    if (attempt.status === "IN_PROGRESS") {
      // Answers sent after the deadline are discarded; whatever was saved in time is graded.
      if (attemptAcceptsAnswers(attempt)) await saveResponses(attemptId, answers);
      await submitAttempt(attemptId);
      await audit({ actorId: user.id, action: "quiz.submit", entityType: "QuizAttempt", entityId: attemptId });
    }
    revalidatePath(`/learn/classes/${attempt.classId}`, "layout");
    return { status: "success", data: { url: `/learn/classes/${attempt.classId}/quiz/${attemptId}/results` } } satisfies ActionState<NavigateResult>;
  },
);

export const gradeQuizAnswer = command(
  {
    schema: z.object({
      answerId: z.string().min(1),
      score: z.number().min(0).max(1000),
      feedback: z.string().trim().max(5000).optional(),
    }),
  },
  async ({ answerId, score, feedback }, user) => {
    const answer = await db.quizAnswer.findUnique({ where: { id: answerId }, select: { attempt: { select: { classId: true, id: true } } } });
    if (!answer) throw new UserError("Answer not found.");
    await requireClassGrader(user, answer.attempt.classId);
    await gradeAnswer({ answerId, score, feedback: feedback || null, graderId: user.id });
    await audit({ actorId: user.id, action: "quiz.grade", entityType: "QuizAttempt", entityId: answer.attempt.id, diff: { answerId, score } });
    revalidatePath(`/teach/grading/attempts/${answer.attempt.id}`);
    revalidatePath("/teach/grading");
    return { status: "success", message: "Score saved." };
  },
);
