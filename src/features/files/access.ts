import "server-only";
import { hasPermission } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Decides who may download a file, based on what references it.
 * Each phase that attaches files to something (entries, submissions, messages…) adds its rule here.
 * Unreferenced files are only visible to their uploader.
 */
export async function canReadFile(user: CurrentUser, fileId: string) {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { studentDocument: { select: { studentId: true } } },
  });
  if (!file) return { file: null, allowed: false };

  if (file.studentDocument) {
    return { file, allowed: hasPermission(user.roles, "students.viewSensitive") };
  }
  return { file, allowed: file.ownerId === user.id };
}
