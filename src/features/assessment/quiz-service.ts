import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { UserError } from "@/lib/actions";
import { db } from "@/lib/db";
import { markEntryCompleted } from "@/features/entries/progress-service";
import { parseContent } from "@/features/entries/registry";
import { sanitizeDoc } from "@/features/entries/rich-text/sanitize";
import { gradeResponse, QUESTION_TYPE_INFO, responseSchemas, emptyResponse, roundScore, type QuestionType } from "./questions";
import { aggregateScore, attemptDeadline, DEADLINE_GRACE_MS, resolveItems, startRefusal, type QuizSettings } from "./quiz";
import { parseTags } from "./tags";

type Tx = Prisma.TransactionClient;

/** Frozen copy of the questions an attempt was given (includes answers: never send to students). */
export type SnapshotItem = {
  questionId: string;
  type: QuestionType;
  prompt: unknown;
  data: unknown;
  points: number;
  explanation: string | null;
};
export type Snapshot = { items: SnapshotItem[] };

export async function loadQuiz(entryId: string) {
  const entry = await db.entry.findFirst({ where: { id: entryId, type: "QUIZ", deletedAt: null }, include: { unit: { select: { courseId: true } } } });
  if (!entry) return null;
  return { entry, content: parseContent("QUIZ", entry.content) };
}

async function bankFor(courseId: string, tx: Tx = db) {
  const rows = await tx.question.findMany({
    where: { courseId, deletedAt: null },
    select: { id: true, tags: true, points: true, type: true, prompt: true, data: true, explanation: true },
  });
  return rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));
}

/** Questions a new attempt would get right now (used for counts in the editor and intro). */
export async function previewQuizItems(courseId: string, items: Parameters<typeof resolveItems>[0]) {
  const bank = await bankFor(courseId);
  return resolveItems(items, bank, "preview", false);
}

export async function attemptsFor(entryId: string, classId: string, userId: string) {
  return db.quizAttempt.findMany({
    where: { entryId, classId, userId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, status: true, score: true, maxScore: true, startedAt: true, submittedAt: true, deadlineAt: true },
  });
}

/** Starts (or resumes) an attempt for a student. Returns its id. */
export async function startAttempt(input: { entryId: string; classId: string; userId: string; dueAt: Date | null; now?: Date }) {
  const now = input.now ?? new Date();
  const quiz = await loadQuiz(input.entryId);
  if (!quiz) throw new UserError("Quiz not found.");
  const { settings, items } = quiz.content;

  await finalizeExpired({ entryId: input.entryId, classId: input.classId, userId: input.userId }, now);
  const attempts = await attemptsFor(input.entryId, input.classId, input.userId);
  const open = attempts.find((a) => a.status === "IN_PROGRESS");
  if (open) return open.id;

  const bank = await bankFor(quiz.entry.unit.courseId);
  const seed = `${input.userId}:${input.entryId}:${attempts.length + 1}`;
  const resolved = resolveItems(items, bank, seed, settings.shuffleQuestions);
  const refusal = startRefusal({ settings, attemptsUsed: attempts.length, dueAt: input.dueAt, now, questionCount: resolved.items.length });
  if (refusal) throw new UserError(refusal);

  const byId = new Map(bank.map((q) => [q.id, q]));
  const snapshot: Snapshot = {
    items: resolved.items.map((it) => {
      const q = byId.get(it.questionId)!;
      return { questionId: q.id, type: q.type, prompt: sanitizeDoc(q.prompt).doc, data: q.data, points: it.points, explanation: q.explanation };
    }),
  };
  const maxScore = roundScore(snapshot.items.reduce((s, i) => s + i.points, 0));

  try {
    const attempt = await db.$transaction(async (tx) => {
      const created = await tx.quizAttempt.create({
        data: {
          entryId: input.entryId,
          classId: input.classId,
          userId: input.userId,
          number: attempts.length + 1,
          startedAt: now,
          deadlineAt: attemptDeadline(now, settings, input.dueAt),
          maxScore,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.quizAnswer.createMany({
        data: snapshot.items.map((i) => ({ attemptId: created.id, questionId: i.questionId, response: emptyResponse(i.type) as Prisma.InputJsonValue })),
      });
      return created;
    });
    return attempt.id;
  } catch (error) {
    // Double click / two tabs: the other request created this attempt number first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const again = await attemptsFor(input.entryId, input.classId, input.userId);
      const inProgress = again.find((a) => a.status === "IN_PROGRESS");
      if (inProgress) return inProgress.id;
    }
    throw error;
  }
}

export function attemptAcceptsAnswers(attempt: { status: string; deadlineAt: Date | null }, now = new Date()) {
  return attempt.status === "IN_PROGRESS" && (!attempt.deadlineAt || now.getTime() <= attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS);
}

/** Saves responses (validated per question type) into an in-progress attempt. */
export async function saveResponses(attemptId: string, answers: { questionId: string; response: unknown }[], tx: Tx = db) {
  const attempt = await tx.quizAttempt.findUnique({ where: { id: attemptId }, select: { snapshot: true, userId: true } });
  if (!attempt) throw new UserError("Attempt not found.");
  const items = new Map((attempt.snapshot as unknown as Snapshot).items.map((i) => [i.questionId, i]));
  for (const a of answers) {
    const item = items.get(a.questionId);
    if (!item) continue;
    const parsed = responseSchemas[item.type].safeParse(a.response);
    if (!parsed.success) throw new UserError("An answer couldn't be saved. Reload and try again.");
    const answer = await tx.quizAnswer.update({
      where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
      data: { response: parsed.data as Prisma.InputJsonValue },
    });
    if (item.type === "FILE_UPLOAD") {
      const fileIds = (parsed.data as { fileIds: string[] }).fileIds;
      // Only the student's own uploads can be attached.
      const owned = await tx.file.count({ where: { id: { in: fileIds }, ownerId: attempt.userId } });
      if (owned !== fileIds.length) throw new UserError("Some files can't be attached. Upload them again.");
      await tx.quizAnswerFile.deleteMany({ where: { answerId: answer.id, fileId: { notIn: fileIds } } });
      await tx.quizAnswerFile.createMany({ data: fileIds.map((fileId) => ({ answerId: answer.id, fileId })), skipDuplicates: true });
    }
  }
}

/** Recomputes an attempt's score and status from its answers. */
async function rescoreAttempt(tx: Tx, attemptId: string) {
  const attempt = await tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
  const items = (attempt.snapshot as unknown as Snapshot).items;
  const answers = new Map(attempt.answers.map((a) => [a.questionId, a]));
  let score = 0;
  let pending = false;
  for (const item of items) {
    const a = answers.get(item.questionId);
    const s = a?.manualScore ?? a?.autoScore ?? null;
    if (s === null) pending = true;
    else score += s;
  }
  return tx.quizAttempt.update({
    where: { id: attemptId },
    data: { score: roundScore(score), status: pending ? "NEEDS_GRADING" : "GRADED" },
  });
}

/** Grades and closes an attempt. Safe to call twice (only in-progress attempts change). */
export async function submitAttempt(attemptId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const claimed = await tx.quizAttempt.updateMany({ where: { id: attemptId, status: "IN_PROGRESS" }, data: { status: "NEEDS_GRADING", submittedAt: now } });
    const attempt = await tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
    if (!claimed.count) return attempt;

    const items = new Map((attempt.snapshot as unknown as Snapshot).items.map((i) => [i.questionId, i]));
    for (const a of attempt.answers) {
      const item = items.get(a.questionId);
      if (!item || QUESTION_TYPE_INFO[item.type].manual) continue;
      const fraction = gradeResponse(item.type, item.data, a.response) ?? 0;
      await tx.quizAnswer.update({ where: { id: a.id }, data: { autoScore: roundScore(fraction * item.points) } });
    }
    const updated = await rescoreAttempt(tx, attemptId);
    await markEntryCompleted({ userId: attempt.userId, entryId: attempt.entryId, classId: attempt.classId }, tx);
    await recomputeQuizGrade(tx, attempt.classId, attempt.userId, attempt.entryId);
    return updated;
  });
}

/** Submits attempts whose deadline (plus grace) has passed. */
export async function finalizeExpired(where: { entryId?: string; classId?: string; userId?: string }, now = new Date()) {
  const expired = await db.quizAttempt.findMany({
    where: { ...where, status: "IN_PROGRESS", deadlineAt: { lt: new Date(now.getTime() - DEADLINE_GRACE_MS) } },
    select: { id: true },
  });
  for (const a of expired) await submitAttempt(a.id, now);
  return expired.length;
}

/** The quiz grade follows the scoring policy over fully graded attempts. */
export async function recomputeQuizGrade(tx: Tx, classId: string, userId: string, entryId: string) {
  const entry = await tx.entry.findUniqueOrThrow({ where: { id: entryId }, select: { content: true } });
  const settings: QuizSettings = parseContent("QUIZ", entry.content).settings;
  const attempts = await tx.quizAttempt.findMany({
    where: { classId, userId, entryId, status: { not: "IN_PROGRESS" } },
    orderBy: { number: "asc" },
  });
  if (!attempts.length) return;
  const graded = attempts.filter((a) => a.status === "GRADED");
  const score = aggregateScore(graded.map((a) => a.score ?? 0), settings.scoring);
  const maxScore = attempts[attempts.length - 1].maxScore;
  await tx.grade.upsert({
    where: { classId_userId_entryId: { classId, userId, entryId } },
    create: { classId, userId, entryId, score, maxScore, released: true, gradedAt: score === null ? null : new Date() },
    update: { score, maxScore, released: true, gradedAt: score === null ? null : new Date() },
  });
}

/** Teacher sets the score (and feedback) for one answer; the attempt and grade are recomputed. */
export async function gradeAnswer(input: { answerId: string; score: number; feedback: string | null; graderId: string }) {
  return db.$transaction(async (tx) => {
    const answer = await tx.quizAnswer.findUnique({ where: { id: input.answerId }, include: { attempt: true } });
    if (!answer) throw new UserError("Answer not found.");
    if (answer.attempt.status === "IN_PROGRESS") throw new UserError("This attempt hasn't been submitted yet.");
    const item = (answer.attempt.snapshot as unknown as Snapshot).items.find((i) => i.questionId === answer.questionId);
    if (!item) throw new UserError("Question not found in this attempt.");
    if (input.score < 0 || input.score > item.points) throw new UserError(`The score must be between 0 and ${item.points}.`);
    await tx.quizAnswer.update({ where: { id: answer.id }, data: { manualScore: roundScore(input.score), feedback: input.feedback } });
    await rescoreAttempt(tx, answer.attemptId);
    await recomputeQuizGrade(tx, answer.attempt.classId, answer.attempt.userId, answer.attempt.entryId);
    await tx.grade.update({
      where: { classId_userId_entryId: { classId: answer.attempt.classId, userId: answer.attempt.userId, entryId: answer.attempt.entryId } },
      data: { gradedById: input.graderId },
    });
    return answer.attempt;
  });
}
