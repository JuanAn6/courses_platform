"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { command, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { activeStudentCount, enrollInLockedClass, lockClasses } from "./enrollment-service";
import { selfEnrollRefusal } from "./rules";

function revalidateClass(classId: string) {
  revalidatePath("/office/enrollments");
  revalidatePath(`/admin/classes/${classId}`);
  revalidatePath(`/teach/classes/${classId}`);
}

const idList = z.array(z.string().min(1)).min(1, "Select at least one student").max(500);

export const enrollStudents = command(
  { permission: "enrollments.manage", schema: z.object({ classId: z.string().min(1), userIds: idList }) },
  async ({ classId, userIds }, actor) => {
    const { enrolled } = await db.$transaction(async (tx) => {
      await lockClasses(tx, [classId]);
      const result = await enrollInLockedClass(tx, classId, userIds);
      await audit({ actorId: actor.id, action: "enrollment.add", entityType: "Class", entityId: classId, diff: { userIds } }, tx);
      return result;
    });
    revalidateClass(classId);
    for (const id of userIds) revalidatePath(`/office/students/${id}`);
    return {
      status: "success",
      message: enrolled ? `Enrolled ${enrolled} student${enrolled === 1 ? "" : "s"}.` : "Those students were already enrolled.",
    };
  },
);

export const withdrawStudents = command(
  {
    permission: "enrollments.manage",
    schema: z.object({ classId: z.string().min(1), userIds: idList, note: z.string().trim().max(200).optional() }),
  },
  async ({ classId, userIds, note }, actor) => {
    const result = await db.classMember.updateMany({
      where: { classId, userId: { in: userIds }, role: "STUDENT", status: "ACTIVE" },
      data: { status: "WITHDRAWN", endedAt: new Date(), note: note || null },
    });
    if (!result.count) throw new UserError("None of those students are actively enrolled.");
    await audit({ actorId: actor.id, action: "enrollment.withdraw", entityType: "Class", entityId: classId, diff: { userIds, note: note ?? null } });
    revalidateClass(classId);
    for (const id of userIds) revalidatePath(`/office/students/${id}`);
    return { status: "success", message: `Withdrew ${result.count} student${result.count === 1 ? "" : "s"}.` };
  },
);

export const moveStudent = command(
  {
    permission: "enrollments.manage",
    schema: z
      .object({ fromClassId: z.string().min(1), toClassId: z.string().min(1), userId: z.string().min(1) })
      .refine((d) => d.fromClassId !== d.toClassId, "Choose a different class"),
  },
  async ({ fromClassId, toClassId, userId }, actor) => {
    await db.$transaction(async (tx) => {
      await lockClasses(tx, [fromClassId, toClassId]);
      const target = await tx.class.findUnique({ where: { id: toClassId }, select: { code: true } });
      if (!target) throw new UserError("Target class not found.");
      const left = await tx.classMember.updateMany({
        where: { classId: fromClassId, userId, role: "STUDENT", status: "ACTIVE" },
        data: { status: "WITHDRAWN", endedAt: new Date(), note: `Moved to ${target.code}` },
      });
      if (!left.count) throw new UserError("The student isn't actively enrolled in the original class.");
      await enrollInLockedClass(tx, toClassId, [userId]);
      await audit(
        { actorId: actor.id, action: "enrollment.move", entityType: "User", entityId: userId, diff: { fromClassId, toClassId } },
        tx,
      );
    });
    revalidateClass(fromClassId);
    revalidateClass(toClassId);
    revalidatePath(`/office/students/${userId}`);
    return { status: "success", message: "Student moved." };
  },
);

/** A signed-in student joins an open class of a self-enroll course from the catalog. */
export const selfEnroll = command({ schema: z.object({ classId: z.string().min(1) }) }, async ({ classId }, user) => {
  if (!user.roles.includes("STUDENT")) throw new UserError("Only student accounts can enroll. Contact the office.");
  await db.$transaction(async (tx) => {
    await lockClasses(tx, [classId]);
    const klass = await tx.class.findUnique({
      where: { id: classId },
      include: { course: { select: { status: true, selfEnroll: true } } },
    });
    if (!klass) throw new UserError("Class not found.");
    const profile = await tx.studentProfile.findUnique({ where: { userId: user.id }, select: { status: true } });
    if (profile?.status !== "ACTIVE") throw new UserError("Your student status isn't active. Contact the office.");
    const existing = await tx.classMember.findUnique({ where: { classId_userId: { classId, userId: user.id } } });
    if (existing && existing.role !== "STUDENT") throw new UserError("You're on this class's staff.");
    const refusal = selfEnrollRefusal({
      courseStatus: klass.course.status,
      selfEnroll: klass.course.selfEnroll,
      classStatus: klass.status,
      capacity: klass.capacity,
      activeStudents: await activeStudentCount(tx, classId),
      existing,
    });
    if (refusal) throw new UserError(refusal);
    await tx.classMember.upsert({
      where: { classId_userId: { classId, userId: user.id } },
      create: { classId, userId: user.id, role: "STUDENT", note: "Self-enrolled" },
      update: { status: "ACTIVE", enrolledAt: new Date(), endedAt: null, note: "Self-enrolled" },
    });
    await audit({ actorId: user.id, action: "enrollment.self", entityType: "Class", entityId: classId }, tx);
  });
  revalidateClass(classId);
  revalidatePath("/learn");
  return { status: "success", message: "You're enrolled!" };
});
