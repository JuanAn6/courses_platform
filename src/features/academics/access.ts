import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { classAccess } from "./rules";

/** Loads a class with the current user's membership and computed access. Memoized per request. */
export const loadClassContext = cache(async (classId: string) => {
  const user = await requireUser();
  const klass = await db.class.findUnique({
    where: { id: classId },
    include: { course: true, term: true },
  });
  if (!klass) return null;
  const membership = await db.classMember.findUnique({
    where: { classId_userId: { classId, userId: user.id } },
    select: { role: true, status: true },
  });
  return { user, klass, membership, access: classAccess({ roles: user.roles, membership, classStatus: klass.status }) };
});

/** For /teach pages: teachers, assistants (of this class) and admins. */
export async function requireClassStaff(classId: string) {
  const ctx = await loadClassContext(classId);
  if (!ctx) notFound();
  if (!ctx.access.isStaff) redirect("/forbidden");
  return ctx;
}

/** For /learn pages: enrolled students (and staff previewing). */
export async function requireClassViewer(classId: string) {
  const ctx = await loadClassContext(classId);
  if (!ctx) notFound();
  if (!ctx.access.canView) redirect("/forbidden");
  return ctx;
}

/** Admins edit every course; teachers edit courses they're listed as editors of. */
export async function canEditCourse(user: CurrentUser, courseId: string): Promise<boolean> {
  if (user.roles.includes("ADMIN")) return true;
  const editor = await db.courseEditor.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  return !!editor;
}
