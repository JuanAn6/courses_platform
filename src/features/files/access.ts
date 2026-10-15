import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { canEditCourse } from "@/features/academics/access";
import { classAccess } from "@/features/academics/rules";
import { canViewEntryContent } from "@/features/entries/access";
import { hasPermission } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const include = {
  studentDocument: { select: { studentId: true } },
  courseCover: { select: { status: true, visibility: true } },
  entries: { select: { entryId: true }, take: 20 },
  questions: { select: { question: { select: { courseId: true } } }, take: 20 },
  submissions: { select: { submission: { select: { userId: true, classId: true } } }, take: 20 },
  quizAnswers: { select: { answer: { select: { attempt: { select: { userId: true, classId: true } } } } }, take: 20 },
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

type Subject = Prisma.FileGetPayload<{ include: typeof include }>;

async function isClassStaff(user: CurrentUser, classId: string) {
  const [klass, membership] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, select: { status: true } }),
    db.classMember.findUnique({ where: { classId_userId: { classId, userId: user.id } }, select: { role: true, status: true } }),
  ]);
  return !!klass && classAccess({ roles: user.roles, membership, classStatus: klass.status }).isStaff;
}

async function allowed(user: CurrentUser | null, file: Subject) {
  if (file.courseCover) {
    // Covers are not sensitive: public for catalog courses, otherwise any signed-in user.
    return (file.courseCover.status === "PUBLISHED" && file.courseCover.visibility === "CATALOG") || !!user;
  }
  if (!user) return false;
  if (file.studentDocument) return hasPermission(user.roles, "students.viewSensitive");
  if (file.ownerId === user.id) return true;

  // Student work: the student who submitted it and the class's staff.
  const work = [
    ...file.submissions.map((s) => s.submission),
    ...file.quizAnswers.map((q) => q.answer.attempt),
  ];
  for (const w of work) {
    if (w.userId === user.id || (await isClassStaff(user, w.classId))) return true;
  }

  for (const { entryId } of file.entries) {
    if (await canViewEntryContent(user, entryId)) return true;
  }

  // Question images: course editors and anyone in a class of the course.
  for (const { question } of file.questions) {
    if (await canEditCourse(user, question.courseId)) return true;
    const member = await db.classMember.findFirst({
      where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] }, class: { courseId: question.courseId } },
      select: { id: true },
    });
    if (member) return true;
  }
  return false;
}

/** Whether a file can be cached by browsers (public, non-sensitive images). */
export function isPublicAsset(file: { courseCover: { status: string; visibility: string } | null }) {
  return file.courseCover?.status === "PUBLISHED" && file.courseCover.visibility === "CATALOG";
}
