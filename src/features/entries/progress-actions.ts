"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { command, ForbiddenError, UserError, type ActionState } from "@/lib/actions";
import { db } from "@/lib/db";
import { classAccess } from "@/features/academics/rules";
import { findEntry } from "./outline";
import { getStudentOutline } from "./queries";
import { completionThreshold, trackingFor, type EntryType } from "./registry";
import { progressSchema } from "./schemas";

export type ProgressResult = { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; percent: number };

/** Records a student's progress on an entry. Staff previews are not recorded. */
export const recordProgress = command({ schema: progressSchema }, async (input, user) => {
  const klass = await db.class.findUnique({ where: { id: input.classId }, select: { courseId: true, status: true } });
  if (!klass) throw new UserError("Class not found.");
  const membership = await db.classMember.findUnique({
    where: { classId_userId: { classId: input.classId, userId: user.id } },
    select: { role: true, status: true },
  });
  const access = classAccess({ roles: user.roles, membership, classStatus: klass.status });
  if (!access.isStudent) {
    if (access.isStaff) return { status: "success" } satisfies ActionState<ProgressResult>; // preview: ignore
    throw new ForbiddenError();
  }

  const outline = await getStudentOutline(input.classId, klass.courseId, user.id);
  const found = findEntry(outline, input.entryId);
  if (!found || found.entry.locked) throw new UserError("This content isn't available yet.");
  const entry = await db.entry.findUnique({ where: { id: input.entryId }, select: { type: true, content: true } });
  if (!entry) throw new UserError("Entry not found.");

  const key = { userId_entryId_classId: { userId: user.id, entryId: input.entryId, classId: input.classId } };
  const existing = await db.entryProgress.findUnique({ where: key });
  // Completed classes are read-only: keep showing progress but don't change it.
  if (klass.status === "COMPLETED") {
    return { status: "success", data: { status: existing?.status ?? "NOT_STARTED", percent: existing?.percent ?? 0 } } satisfies ActionState<ProgressResult>;
  }

  const type = entry.type as EntryType;
  const tracking = trackingFor(type, entry.content);
  let percent = Math.max(existing?.percent ?? 0, Math.round(input.percent ?? 0));
  let completed = existing?.status === "COMPLETED";

  if (tracking === "manual" || tracking === "link") {
    if (input.complete === true) completed = true;
    if (input.complete === false && tracking === "manual") completed = false; // undo "mark as done"
  } else if (tracking === "media") {
    if (percent >= completionThreshold(type, entry.content)) completed = true;
  } else if (tracking === "pages" && percent >= 100) {
    completed = true;
  }
  if (completed) percent = 100;
  else if (tracking === "manual" || tracking === "link") percent = 0;

  const status = completed ? "COMPLETED" : "IN_PROGRESS";
  const data = {
    status,
    percent,
    lastPosition: input.position ?? existing?.lastPosition ?? null,
    timeSpentSec: (existing?.timeSpentSec ?? 0) + Math.min(Math.round(input.deltaSec ?? 0), 120),
    completedAt: completed ? (existing?.completedAt ?? new Date()) : null,
  } as const;

  try {
    await db.entryProgress.upsert({
      where: key,
      create: { userId: user.id, entryId: input.entryId, classId: input.classId, ...data },
      update: data,
    });
  } catch (error) {
    // Two tabs creating the row at once: the loser updates instead.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await db.entryProgress.update({ where: key, data });
    } else throw error;
  }

  if (completed !== (existing?.status === "COMPLETED")) revalidatePath(`/learn/classes/${input.classId}`, "layout");
  return { status: "success", data: { status, percent } } satisfies ActionState<ProgressResult>;
});
