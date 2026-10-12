import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { UserError } from "@/lib/actions";
import { enrollmentRefusal } from "./rules";

type Tx = Prisma.TransactionClient;

/**
 * Locks the class row for the rest of the transaction so concurrent enrollments
 * can't both pass the capacity check. Lock several classes in id order to avoid deadlocks.
 */
export async function lockClasses(tx: Tx, classIds: string[]) {
  for (const id of [...new Set(classIds)].sort()) {
    await tx.$queryRaw`SELECT id FROM classes WHERE id = ${id} FOR UPDATE`;
  }
}

export async function activeStudentCount(tx: Tx, classId: string) {
  return tx.classMember.count({ where: { classId, role: "STUDENT", status: "ACTIVE" } });
}

/** Adds students to a locked class. Returns how many were newly enrolled. */
export async function enrollInLockedClass(tx: Tx, classId: string, userIds: string[]) {
  const klass = await tx.class.findUnique({ where: { id: classId }, select: { status: true, capacity: true, code: true } });
  if (!klass) throw new UserError("Class not found.");

  const students = await tx.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      roles: { select: { role: true } },
      studentProfile: { select: { status: true } },
      memberships: { where: { classId }, select: { role: true, status: true } },
    },
  });
  if (students.length !== new Set(userIds).size) throw new UserError("Some selected students no longer exist.");

  const problems: string[] = [];
  const toEnroll: string[] = [];
  for (const s of students) {
    const membership = s.memberships[0];
    if (s.deletedAt || !s.roles.some((r) => r.role === "STUDENT")) problems.push(`${s.name} isn't a student.`);
    else if (s.studentProfile?.status !== "ACTIVE") problems.push(`${s.name}'s student status isn't Active.`);
    else if (membership && membership.role !== "STUDENT" && membership.status === "ACTIVE") problems.push(`${s.name} is on this class's staff.`);
    else if (membership?.role === "STUDENT" && membership.status === "ACTIVE") continue; // already enrolled
    else toEnroll.push(s.id);
  }
  if (problems.length) throw new UserError(problems.join(" "));

  const refusal = enrollmentRefusal({
    classStatus: klass.status,
    capacity: klass.capacity,
    activeStudents: await activeStudentCount(tx, classId),
    adding: toEnroll.length,
  });
  if (refusal) throw new UserError(refusal);

  const now = new Date();
  for (const userId of toEnroll) {
    await tx.classMember.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId, role: "STUDENT" },
      update: { role: "STUDENT", status: "ACTIVE", enrolledAt: now, endedAt: null, note: null },
    });
  }
  return { enrolled: toEnroll.length, code: klass.code };
}
