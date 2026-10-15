import "server-only";
import { ForbiddenError, UserError } from "@/lib/actions";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { classAccess } from "@/features/academics/rules";
import { findEntry } from "@/features/entries/outline";
import { getStudentOutline } from "@/features/entries/queries";

/**
 * A student acting on an entry: must be a student of the class, the class must be ACTIVE,
 * and the entry must be visible and unlocked for them. Returns the effective due date
 * (class overrides applied).
 */
export async function requireStudentEntry(user: CurrentUser, classId: string, entryId: string) {
  const klass = await db.class.findUnique({ where: { id: classId }, select: { id: true, courseId: true, status: true } });
  if (!klass) throw new UserError("Class not found.");
  const membership = await db.classMember.findUnique({
    where: { classId_userId: { classId, userId: user.id } },
    select: { role: true, status: true },
  });
  if (!classAccess({ roles: user.roles, membership, classStatus: klass.status }).isStudent) throw new ForbiddenError();
  if (klass.status !== "ACTIVE") throw new UserError("This class has ended.");
  const outline = await getStudentOutline(classId, klass.courseId, user.id);
  const found = findEntry(outline, entryId);
  if (!found || found.entry.locked) throw new UserError("This isn't available yet.");
  return { klass, dueAt: found.entry.dueAt };
}

/** Staff (teacher, assistant or admin) of a class, for grading. */
export async function requireClassGrader(user: CurrentUser, classId: string) {
  const klass = await db.class.findUnique({ where: { id: classId }, select: { status: true } });
  if (!klass) throw new UserError("Class not found.");
  const membership = await db.classMember.findUnique({
    where: { classId_userId: { classId, userId: user.id } },
    select: { role: true, status: true },
  });
  if (!classAccess({ roles: user.roles, membership, classStatus: klass.status }).isStaff) throw new ForbiddenError();
}

/** Page-friendly version of requireClassGrader. */
export async function canGradeClass(user: CurrentUser, classId: string) {
  try {
    await requireClassGrader(user, classId);
    return true;
  } catch {
    return false;
  }
}
