"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { action, command, ForbiddenError, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { optionalText } from "@/lib/zod";
import { canEditCourse } from "@/features/academics/access";
import { sanitizeDoc } from "@/features/entries/rich-text/sanitize";
import { QUESTION_TYPES, questionDataSchemas } from "./questions";
import { normalizeTags, serializeTags } from "./tags";

const saveSchema = z.object({
  questionId: z.string().optional().transform((v) => v || null),
  courseId: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().max(500_000),
  data: z.string().max(200_000),
  explanation: optionalText(5000),
  points: z.coerce.number().min(0, "Points can't be negative").max(1000),
  tags: z.string().max(500).optional().default(""),
  difficulty: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(1).max(3).nullable()),
});

export type SaveQuestionResult = { questionId: string };

export const saveQuestion = action({ schema: saveSchema }, async (input, user) => {
  if (!(await canEditCourse(user, input.courseId))) throw new ForbiddenError();

  let promptRaw: unknown;
  let dataRaw: unknown;
  try {
    promptRaw = JSON.parse(input.prompt);
    dataRaw = JSON.parse(input.data);
  } catch {
    throw new UserError("The question couldn't be read. Reload and try again.");
  }
  const { doc, fileIds, textLength } = sanitizeDoc(promptRaw);
  if (!textLength && !fileIds.length) return { status: "error", message: "Write the question.", fieldErrors: { prompt: ["Write the question"] } };
  const data = questionDataSchemas[input.type].safeParse(dataRaw);
  if (!data.success) {
    const message = data.error.issues[0]?.message ?? "Check the answer settings.";
    return { status: "error", message, fieldErrors: { data: [message] } };
  }

  // Prompt images must be the editor's own uploads (or already used in this course's bank).
  if (fileIds.length) {
    const files = await db.file.findMany({
      where: { id: { in: fileIds } },
      select: { id: true, ownerId: true, questions: { select: { question: { select: { courseId: true } } } } },
    });
    const ok = files.length === fileIds.length && files.every(
      (f) => f.ownerId === user.id || user.roles.includes("ADMIN") || f.questions.some((q) => q.question.courseId === input.courseId),
    );
    if (!ok) throw new UserError("Some images can't be used. Upload them again.");
  }

  const values = {
    type: input.type,
    prompt: doc as Prisma.InputJsonValue,
    data: data.data as Prisma.InputJsonValue,
    explanation: input.explanation,
    points: input.points,
    tags: serializeTags(normalizeTags(input.tags)),
    difficulty: input.difficulty,
  };

  const question = await db.$transaction(async (tx) => {
    let q;
    if (input.questionId) {
      const existing = await tx.question.findFirst({ where: { id: input.questionId, courseId: input.courseId, deletedAt: null } });
      if (!existing) throw new UserError("Question not found.");
      q = await tx.question.update({ where: { id: existing.id }, data: values });
    } else {
      q = await tx.question.create({ data: { ...values, courseId: input.courseId, createdById: user.id } });
    }
    await tx.questionFile.deleteMany({ where: { questionId: q.id, fileId: { notIn: fileIds } } });
    await tx.questionFile.createMany({ data: fileIds.map((fileId) => ({ questionId: q.id, fileId })), skipDuplicates: true });
    await audit({ actorId: user.id, action: input.questionId ? "question.update" : "question.create", entityType: "Question", entityId: q.id }, tx);
    return q;
  });

  revalidatePath(`/teach/courses/${input.courseId}/questions`);
  return { status: "success", message: "Question saved.", data: { questionId: question.id } } satisfies ActionState<SaveQuestionResult>;
});

async function loadEditable(user: CurrentUser, questionId: string) {
  const q = await db.question.findFirst({ where: { id: questionId, deletedAt: null } });
  if (!q) throw new UserError("Question not found.");
  if (!(await canEditCourse(user, q.courseId))) throw new ForbiddenError();
  return q;
}

export const deleteQuestion = command({ schema: z.object({ questionId: z.string().min(1) }) }, async ({ questionId }, user) => {
  const q = await loadEditable(user, questionId);
  await db.question.update({ where: { id: q.id }, data: { deletedAt: new Date() } });
  await audit({ actorId: user.id, action: "question.delete", entityType: "Question", entityId: q.id });
  revalidatePath(`/teach/courses/${q.courseId}/questions`);
  return { status: "success", message: "Question deleted. Quizzes that use it will skip it." };
});

export const duplicateQuestion = command({ schema: z.object({ questionId: z.string().min(1) }) }, async ({ questionId }, user) => {
  const q = await loadEditable(user, questionId);
  const files = await db.questionFile.findMany({ where: { questionId } });
  const copy = await db.question.create({
    data: {
      courseId: q.courseId,
      type: q.type,
      prompt: q.prompt as Prisma.InputJsonValue,
      data: q.data as Prisma.InputJsonValue,
      explanation: q.explanation,
      points: q.points,
      tags: q.tags,
      difficulty: q.difficulty,
      createdById: user.id,
    },
  });
  if (files.length) await db.questionFile.createMany({ data: files.map((f) => ({ questionId: copy.id, fileId: f.fileId })) });
  await audit({ actorId: user.id, action: "question.duplicate", entityType: "Question", entityId: copy.id, diff: { from: q.id } });
  revalidatePath(`/teach/courses/${q.courseId}/questions`);
  return { status: "success", message: "Question duplicated." };
});
