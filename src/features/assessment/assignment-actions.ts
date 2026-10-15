"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { command, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { markEntryCompleted } from "@/features/entries/progress-service";
import { assignmentMaxScore, parseContent } from "@/features/entries/registry";
import { roundScore } from "./questions";
import { rubricScore } from "./rubric";
import { requireClassGrader, requireStudentEntry } from "./student-access";

const submitSchema = z.object({
  classId: z.string().min(1),
  entryId: z.string().min(1),
  text: z.string().max(100_000).default(""),
  fileIds: z.array(z.string().min(1).max(40)).max(10).default([]),
});

export const submitAssignment = command({ schema: submitSchema }, async (input, user) => {
  const { dueAt } = await requireStudentEntry(user, input.classId, input.entryId);
  const entry = await db.entry.findFirst({ where: { id: input.entryId, type: "ASSIGNMENT", deletedAt: null } });
  if (!entry) throw new UserError("Assignment not found.");
  const content = parseContent("ASSIGNMENT", entry.content);

  const text = content.allowText ? input.text.trim() : "";
  const fileIds = content.allowFiles ? [...new Set(input.fileIds)] : [];
  if (!text && !fileIds.length) throw new UserError(content.allowFiles && content.allowText ? "Write something or attach a file." : content.allowFiles ? "Attach a file." : "Write your answer.");
  if (fileIds.length > content.maxFiles) throw new UserError(`You can attach up to ${content.maxFiles} files.`);

  const submission = await db.$transaction(async (tx) => {
    const previous = await tx.submission.findFirst({
      where: { entryId: input.entryId, classId: input.classId, userId: user.id },
      orderBy: { number: "desc" },
    });
    if (previous && !content.allowResubmission) throw new UserError("You've already submitted this assignment.");
    if (fileIds.length) {
      const owned = await tx.file.count({ where: { id: { in: fileIds }, ownerId: user.id } });
      if (owned !== fileIds.length) throw new UserError("Some files can't be attached. Upload them again.");
    }
    const now = new Date();
    const created = await tx.submission.create({
      data: {
        entryId: input.entryId,
        classId: input.classId,
        userId: user.id,
        number: (previous?.number ?? 0) + 1,
        text: text || null,
        late: !!dueAt && now > dueAt,
        submittedAt: now,
      },
    });
    if (fileIds.length) await tx.submissionFile.createMany({ data: fileIds.map((fileId) => ({ submissionId: created.id, fileId })) });
    await markEntryCompleted({ userId: user.id, entryId: input.entryId, classId: input.classId }, tx);
    await audit({ actorId: user.id, action: "assignment.submit", entityType: "Submission", entityId: created.id, diff: { number: created.number } }, tx);
    return created;
  });

  revalidatePath(`/learn/classes/${input.classId}`, "layout");
  revalidatePath("/teach/grading");
  return { status: "success", message: submission.number > 1 ? "Resubmitted." : "Submitted." };
});

const gradeSchema = z.object({
  submissionId: z.string().min(1),
  /** Used when the assignment has no rubric. */
  score: z.number().min(0).max(1000).nullable().default(null),
  rubric: z.record(z.string().max(40), z.string().max(40)).nullable().default(null),
  feedback: z.string().trim().max(10_000).default(""),
  release: z.boolean().default(true),
});

export const gradeSubmission = command({ schema: gradeSchema }, async (input, user) => {
  const submission = await db.submission.findUnique({ where: { id: input.submissionId }, include: { entry: true } });
  if (!submission) throw new UserError("Submission not found.");
  await requireClassGrader(user, submission.classId);
  const content = parseContent("ASSIGNMENT", submission.entry.content);
  const maxScore = assignmentMaxScore(submission.entry.content);

  let score: number;
  let rubric: Record<string, string> | null = null;
  if (content.rubric) {
    const result = rubricScore(content.rubric, input.rubric ?? {});
    if (!result.complete) throw new UserError("Choose a level for every rubric criterion.");
    score = result.score;
    rubric = input.rubric;
  } else {
    if (input.score === null) throw new UserError("Enter a score.");
    if (input.score > maxScore) throw new UserError(`The score can't exceed ${maxScore}.`);
    score = roundScore(input.score);
  }

  await db.$transaction(async (tx) => {
    await tx.submission.update({ where: { id: submission.id }, data: { status: "GRADED" } });
    const data = {
      score,
      maxScore,
      feedback: input.feedback || null,
      rubric: (rubric ?? undefined) as Prisma.InputJsonValue | undefined,
      gradedById: user.id,
      gradedAt: new Date(),
      released: input.release,
    };
    await tx.grade.upsert({
      where: { classId_userId_entryId: { classId: submission.classId, userId: submission.userId, entryId: submission.entryId } },
      create: { classId: submission.classId, userId: submission.userId, entryId: submission.entryId, ...data },
      update: data,
    });
    await audit({ actorId: user.id, action: "assignment.grade", entityType: "Submission", entityId: submission.id, diff: { score, released: input.release } }, tx);
  });

  revalidatePath(`/teach/grading/submissions/${submission.id}`);
  revalidatePath("/teach/grading");
  revalidatePath(`/learn/classes/${submission.classId}`, "layout");
  return { status: "success", message: input.release ? "Grade saved and released." : "Grade saved (not released yet)." } satisfies ActionState;
});
