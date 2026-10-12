import "server-only";
import { canViewEntryContent } from "@/features/entries/access";
import { hasPermission } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const include = {
  studentDocument: { select: { studentId: true } },
  courseCover: { select: { status: true, visibility: true } },
  entries: { select: { entryId: true }, take: 20 },
} as const;

/**
 * Decides who may download a file, based on what references it.
 * Each phase that attaches files to something adds its rule here.
 * Unreferenced files are only visible to their uploader. `user` is null for anonymous visitors.
 * Renditions (e.g. a PDF converted from a PowerPoint) follow their source file.
 */
export async function canReadFile(user: CurrentUser | null, fileId: string) {
  const file = await db.file.findUnique({ where: { id: fileId }, include });
  if (!file) return { file: null, allowed: false };
  const subject = file.sourceId ? await db.file.findUnique({ where: { id: file.sourceId }, include }) : file;
  if (!subject) return { file, allowed: false };
  return { file, allowed: await allowed(user, subject) };
}

async function allowed(
  user: CurrentUser | null,
  file: {
    ownerId: string | null;
    studentDocument: { studentId: string } | null;
    courseCover: { status: string; visibility: string } | null;
    entries: { entryId: string }[];
  },
) {
  if (file.courseCover) {
    // Covers are not sensitive: public for catalog courses, otherwise any signed-in user.
    return (file.courseCover.status === "PUBLISHED" && file.courseCover.visibility === "CATALOG") || !!user;
  }
  if (!user) return false;
  if (file.studentDocument) return hasPermission(user.roles, "students.viewSensitive");
  if (file.ownerId === user.id) return true;
  for (const { entryId } of file.entries) {
    if (await canViewEntryContent(user, entryId)) return true;
  }
  return false;
}

/** Whether a file can be cached by browsers (public, non-sensitive images). */
export function isPublicAsset(file: { courseCover: { status: string; visibility: string } | null }) {
  return file.courseCover?.status === "PUBLISHED" && file.courseCover.visibility === "CATALOG";
}
