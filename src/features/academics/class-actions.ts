"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { action, command, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { diffObjects } from "@/lib/diff";
import { canHoldClassRole } from "./rules";
import { classSchema, cloneClassSchema, STAFF_ROLES, updateClassSchema } from "./schemas";

type Tx = Prisma.TransactionClient;

async function assertCodeFree(tx: Tx, code: string, exceptId?: string) {
  const clash = await tx.class.findUnique({ where: { code }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw new UserError(`Class code ${code} is already in use.`);
}

async function assertRefs(tx: Tx, courseId: string, termId: string | null) {
  const course = await tx.course.findUnique({ where: { id: courseId }, select: { status: true } });
  if (!course) throw new UserError("Course not found.");
  if (termId && !(await tx.academicTerm.findUnique({ where: { id: termId } }))) throw new UserError("Term not found.");
}

export const createClass = action({ permission: "classes.manage", schema: classSchema }, async (input, actor) => {
  const klass = await db.$transaction(async (tx) => {
    await assertRefs(tx, input.courseId, input.termId);
    await assertCodeFree(tx, input.code);
    const created = await tx.class.create({ data: input });
    await audit({ actorId: actor.id, action: "class.create", entityType: "Class", entityId: created.id }, tx);
    return created;
  });
  revalidatePath("/admin/classes");
  redirect(`/admin/classes/${klass.id}`);
});

export const updateClass = action({ permission: "classes.manage", schema: updateClassSchema }, async (input, actor) => {
  const { classId, ...data } = input;
  await db.$transaction(async (tx) => {
    const before = await tx.class.findUnique({ where: { id: classId } });
    if (!before) throw new UserError("Class not found.");
    await assertRefs(tx, data.courseId, data.termId);
    await assertCodeFree(tx, data.code, classId);
    await tx.class.update({ where: { id: classId }, data });
    const previous = Object.fromEntries(Object.keys(data).map((k) => [k, before[k as keyof typeof before]]));
    const diff = diffObjects(previous, data);
    if (Object.keys(diff.before).length) {
      await audit({ actorId: actor.id, action: "class.update", entityType: "Class", entityId: classId, diff }, tx);
    }
  });
  revalidatePath(`/admin/classes/${classId}`);
  return { status: "success", message: "Class saved." };
});

/** Copies course, staff and settings into a new DRAFT class (no students). */
export const cloneClass = action({ permission: "classes.manage", schema: cloneClassSchema }, async (input, actor) => {
  const created = await db.$transaction(async (tx) => {
    const source = await tx.class.findUnique({
      where: { id: input.sourceClassId },
      include: { members: { where: { role: { in: ["TEACHER", "ASSISTANT"] }, status: "ACTIVE" } } },
    });
    if (!source) throw new UserError("Class not found.");
    await assertRefs(tx, source.courseId, input.termId);
    await assertCodeFree(tx, input.code);
    const copy = await tx.class.create({
      data: {
        courseId: source.courseId,
        termId: input.termId,
        name: input.name,
        code: input.code,
        startDate: input.startDate,
        endDate: input.endDate,
        capacity: source.capacity,
        boardPolicy: source.boardPolicy,
        status: "DRAFT",
      },
    });
    if (source.members.length) {
      await tx.classMember.createMany({
        data: source.members.map((m) => ({ classId: copy.id, userId: m.userId, role: m.role })),
      });
    }
    await audit({ actorId: actor.id, action: "class.clone", entityType: "Class", entityId: copy.id, diff: { from: source.id } }, tx);
    return copy;
  });
  redirect(`/admin/classes/${created.id}`);
});

const staffSchema = z.object({
  classId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(STAFF_ROLES),
});

export const addClassStaff = command({ permission: "classes.manage", schema: staffSchema }, async (input, actor) => {
  const user = await db.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { name: true, roles: { select: { role: true } } },
  });
  if (!user) throw new UserError("User not found.");
  if (!canHoldClassRole(user.roles.map((r) => r.role), input.role)) {
    throw new UserError(
      input.role === "TEACHER" ? `${user.name} doesn't have the Teacher role.` : `${user.name} must be a teacher or teaching assistant.`,
    );
  }
  const existing = await db.classMember.findUnique({ where: { classId_userId: { classId: input.classId, userId: input.userId } } });
  if (existing?.role === "STUDENT" && existing.status === "ACTIVE") {
    throw new UserError(`${user.name} is enrolled as a student in this class.`);
  }
  await db.classMember.upsert({
    where: { classId_userId: { classId: input.classId, userId: input.userId } },
    create: { classId: input.classId, userId: input.userId, role: input.role },
    update: { role: input.role, status: "ACTIVE", endedAt: null, enrolledAt: new Date(), note: null },
  });
  await audit({ actorId: actor.id, action: "class.staff.add", entityType: "Class", entityId: input.classId, diff: { userId: input.userId, role: input.role } });
  revalidatePath(`/admin/classes/${input.classId}`);
  return { status: "success", message: `${user.name} added.` };
});

export const removeClassStaff = command(
  { permission: "classes.manage", schema: z.object({ classId: z.string().min(1), userId: z.string().min(1) }) },
  async (input, actor) => {
    const updated = await db.classMember.updateMany({
      where: { classId: input.classId, userId: input.userId, role: { in: ["TEACHER", "ASSISTANT"] }, status: "ACTIVE" },
      data: { status: "WITHDRAWN", endedAt: new Date() },
    });
    if (!updated.count) throw new UserError("That person isn't on this class's staff.");
    await audit({ actorId: actor.id, action: "class.staff.remove", entityType: "Class", entityId: input.classId, diff: { userId: input.userId } });
    revalidatePath(`/admin/classes/${input.classId}`);
    return { status: "success", message: "Removed from staff." };
  },
);
