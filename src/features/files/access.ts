import "server-only";
import { hasPermission } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Decides who may download a file, based on what references it.
 * Each phase that attaches files to something (entries, submissions, messages…) adds its rule here.
 * Unreferenced files are only visible to their uploader. `user` is null for anonymous visitors.
 */
export async function canReadFile(user: CurrentUser | null, fileId: string) {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: {
      studentDocument: { select: { studentId: true } },
      courseCover: { select: { status: true, visibility: true } },
    },
  });
  if (!file) return { file: null, allowed: false };

  if (file.courseCover) {
    // Covers are not sensitive: public for catalog courses, otherwise any signed-in user.
    const isPublic = file.courseCover.status === "PUBLISHED" && file.courseCover.visibility === "CATALOG";
    return { file, allowed: isPublic || !!user };
  }
  if (!user) return { file, allowed: false };
  if (file.studentDocument) {
    return { file, allowed: hasPermission(user.roles, "students.viewSensitive") };
  }
  return { file, allowed: file.ownerId === user.id };
}

/** Whether a file can be cached by browsers (public, non-sensitive images). */
export function isPublicAsset(file: { courseCover: { status: string; visibility: string } | null }) {
  return file.courseCover?.status === "PUBLISHED" && file.courseCover.visibility === "CATALOG";
}
