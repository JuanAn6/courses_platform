import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { finalizeExpired } from "./quiz-service";

/** Classes the user grades in (admins: every non-archived class). */
async function gradedClassIds(user: CurrentUser): Promise<string[] | "all"> {
  if (user.roles.includes("ADMIN")) return "all";
  const rows = await db.classMember.findMany({
    where: { userId: user.id, role: { in: ["TEACHER", "ASSISTANT"] }, status: "ACTIVE" },
    select: { classId: true },
  });
  return rows.map((r) => r.classId);
}

/** Everything waiting for a teacher: quiz attempts with manual questions and ungraded latest submissions. */
export async function gradingQueue(user: CurrentUser) {
  const ids = await gradedClassIds(user);
  const classFilter: Prisma.ClassWhereInput = { status: { not: "ARCHIVED" }, ...(ids === "all" ? {} : { id: { in: ids } }) };
  // Close attempts whose time ran out, so they show up for grading.
  await finalizeExpired({});

  const [attempts, submissions] = await Promise.all([
    db.quizAttempt.findMany({
      where: { status: "NEEDS_GRADING", class: classFilter },
      orderBy: { submittedAt: "asc" },
      take: 200,
      include: { user: { select: { name: true } }, entry: { select: { title: true } }, class: { select: { id: true, name: true } } },
    }),
    db.submission.findMany({
      where: { status: "SUBMITTED", class: classFilter },
      orderBy: { submittedAt: "asc" },
      take: 500,
      include: { user: { select: { name: true } }, entry: { select: { title: true } }, class: { select: { id: true, name: true } } },
    }),
  ]);

  // Only the newest version of each student's work needs grading.
  const key = (s: { entryId: string; classId: string; userId: string }) => `${s.entryId}:${s.classId}:${s.userId}`;
  const newest = submissions.length
    ? await db.submission.groupBy({
        by: ["entryId", "classId", "userId"],
        where: { OR: submissions.map((s) => ({ entryId: s.entryId, classId: s.classId, userId: s.userId })) },
        _max: { number: true },
      })
    : [];
  const latest = new Map(newest.map((v) => [key(v), v._max.number ?? 0]));
  const pendingSubmissions = submissions.filter((s) => latest.get(key(s)) === s.number);

  return { attempts, submissions: pendingSubmissions };
}

/** Gradable entries (published quizzes and assignments) visible to a class. */
export async function classAssessments(classId: string, courseId: string) {
  const entries = await db.entry.findMany({
    where: {
      type: { in: ["QUIZ", "ASSIGNMENT"] },
      deletedAt: null,
      unit: { courseId, deletedAt: null, OR: [{ classId: null }, { classId }] },
    },
    orderBy: [{ unit: { position: "asc" } }, { position: "asc" }],
    select: { id: true, title: true, type: true, status: true, dueAt: true, unit: { select: { title: true } } },
  });
  const ids = entries.map((e) => e.id);
  const [grades, attempts, submissions] = await Promise.all([
    db.grade.groupBy({ by: ["entryId"], where: { classId, entryId: { in: ids }, score: { not: null } }, _count: { _all: true }, _avg: { score: true } }),
    db.quizAttempt.groupBy({ by: ["entryId"], where: { classId, entryId: { in: ids }, status: "NEEDS_GRADING" }, _count: { _all: true } }),
    db.submission.groupBy({ by: ["entryId"], where: { classId, entryId: { in: ids }, status: "SUBMITTED" }, _count: { _all: true } }),
  ]);
  const count = (rows: { entryId: string; _count: { _all: number } }[], id: string) => rows.find((r) => r.entryId === id)?._count._all ?? 0;
  return entries.map((e) => ({
    ...e,
    graded: count(grades, e.id),
    average: grades.find((g) => g.entryId === e.id)?._avg.score ?? null,
    pending: count(attempts, e.id) + count(submissions, e.id),
  }));
}

/** Per-student status for one assessment in a class. */
export async function assessmentResults(classId: string, entryId: string) {
  await finalizeExpired({ classId, entryId });
  const [students, attempts, submissions, grades] = await Promise.all([
    db.classMember.findMany({
      where: { classId, role: "STUDENT", status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.quizAttempt.findMany({ where: { classId, entryId }, orderBy: { number: "desc" }, select: { id: true, userId: true, number: true, status: true, score: true, maxScore: true, submittedAt: true } }),
    db.submission.findMany({ where: { classId, entryId }, orderBy: { number: "desc" }, select: { id: true, userId: true, number: true, status: true, late: true, submittedAt: true } }),
    db.grade.findMany({ where: { classId, entryId } }),
  ]);
  return students.map(({ user }) => ({
    user,
    attempts: attempts.filter((a) => a.userId === user.id),
    latestSubmission: submissions.find((s) => s.userId === user.id) ?? null,
    grade: grades.find((g) => g.userId === user.id) ?? null,
  }));
}
