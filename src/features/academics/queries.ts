import "server-only";
import type { ClassStatus, CourseStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const PAGE_SIZE = 25;

function page<T extends { id: string }>(rows: T[]) {
  return {
    items: rows.slice(0, PAGE_SIZE),
    nextCursor: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].id : null,
  };
}

// ───────────── Categories & terms ─────────────

export type CategoryNode = { id: string; name: string; slug: string; depth: number; courseCount: number; parentId: string | null };

/** Categories flattened depth-first (for indented lists and selects). */
export async function listCategoriesFlat(): Promise<CategoryNode[]> {
  const all = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { courses: true } } },
  });
  const byParent = new Map<string | null, typeof all>();
  for (const c of all) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const out: CategoryNode[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ id: c.id, name: c.name, slug: c.slug, depth, courseCount: c._count.courses, parentId: c.parentId });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function listTerms() {
  return db.academicTerm.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { classes: true } } },
  });
}

// ───────────── Courses ─────────────

export async function listCourses(opts: { q?: string; status?: CourseStatus; categoryId?: string; cursor?: string }) {
  const where: Prisma.CourseWhereInput = {
    ...(opts.status ? { status: opts.status } : { status: { not: "ARCHIVED" } }),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.q ? { OR: [{ title: { contains: opts.q } }, { code: { contains: opts.q } }] } : {}),
  };
  const rows = await db.course.findMany({
    where,
    orderBy: [{ title: "asc" }, { id: "asc" }],
    take: PAGE_SIZE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: { category: { select: { name: true } }, _count: { select: { classes: true } } },
  });
  return page(rows);
}

export function getCourseAdmin(id: string) {
  return db.course.findUnique({
    where: { id },
    include: {
      category: true,
      editors: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      classes: {
        orderBy: [{ startDate: "desc" }, { name: "asc" }],
        include: { term: { select: { name: true } }, _count: { select: { members: { where: { role: "STUDENT", status: "ACTIVE" } } } } },
      },
    },
  });
}

/** Active users holding one of the roles (for staff/editor pickers). */
export function listUsersWithRoles(roles: ("TEACHER" | "ASSISTANT")[]) {
  return db.user.findMany({
    where: { deletedAt: null, status: { not: "SUSPENDED" }, roles: { some: { role: { in: roles } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, roles: { select: { role: true } } },
  });
}

export function listCourseOptions() {
  return db.course.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { title: "asc" },
    select: { id: true, code: true, title: true },
  });
}

// ───────────── Classes ─────────────

const activeStudents = { members: { where: { role: "STUDENT" as const, status: "ACTIVE" as const } } };

export async function listClasses(opts: {
  q?: string;
  termId?: string;
  courseId?: string;
  status?: ClassStatus;
  cursor?: string;
}) {
  const where: Prisma.ClassWhereInput = {
    ...(opts.status ? { status: opts.status } : { status: { not: "ARCHIVED" } }),
    ...(opts.termId ? { termId: opts.termId } : {}),
    ...(opts.courseId ? { courseId: opts.courseId } : {}),
    ...(opts.q
      ? { OR: [{ name: { contains: opts.q } }, { code: { contains: opts.q } }, { course: { title: { contains: opts.q } } }] }
      : {}),
  };
  const rows = await db.class.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { name: "asc" }, { id: "asc" }],
    take: PAGE_SIZE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      course: { select: { title: true, code: true } },
      term: { select: { name: true } },
      _count: { select: activeStudents },
      members: { where: { role: "TEACHER", status: "ACTIVE" }, select: { user: { select: { name: true } } } },
    },
  });
  return page(rows);
}

export function getClassAdmin(id: string) {
  return db.class.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true, code: true } },
      term: true,
      members: {
        include: { user: { select: { id: true, name: true, email: true, studentProfile: { select: { studentCode: true } } } } },
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
      },
    },
  });
}

/** Classes that can receive students, for pickers (office, student record, move dialog). */
export function listEnrollableClasses() {
  return db.class.findMany({
    where: { status: { in: ["DRAFT", "ACTIVE"] } },
    orderBy: [{ course: { title: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      capacity: true,
      status: true,
      course: { select: { title: true } },
      term: { select: { name: true } },
      _count: { select: activeStudents },
    },
  });
}

export function getRoster(classId: string) {
  return db.classMember.findMany({
    where: { classId },
    orderBy: [{ role: "asc" }, { status: "asc" }, { user: { name: "asc" } }],
    include: {
      user: { select: { id: true, name: true, email: true, studentProfile: { select: { studentCode: true, status: true } } } },
    },
  });
}

/** Active students not in the class (any status), matching a search, for the "add students" picker. */
export function searchEnrollableStudents(classId: string, q: string | undefined) {
  return db.user.findMany({
    where: {
      deletedAt: null,
      roles: { some: { role: "STUDENT" } },
      studentProfile: { is: { status: "ACTIVE" } },
      memberships: { none: { classId, status: "ACTIVE" } },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { studentProfile: { is: { studentCode: { contains: q } } } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 50,
    select: { id: true, name: true, email: true, studentProfile: { select: { studentCode: true } } },
  });
}

export function getStudentEnrollments(userId: string) {
  return db.classMember.findMany({
    where: { userId, role: "STUDENT" },
    orderBy: { enrolledAt: "desc" },
    include: {
      class: {
        select: { id: true, name: true, code: true, status: true, course: { select: { title: true } }, term: { select: { name: true } } },
      },
    },
  });
}

// ───────────── Teacher / student views ─────────────

export function myTeachingClasses(userId: string) {
  return db.class.findMany({
    where: {
      status: { not: "ARCHIVED" },
      members: { some: { userId, role: { in: ["TEACHER", "ASSISTANT"] }, status: "ACTIVE" } },
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
    include: {
      course: { select: { title: true, code: true } },
      term: { select: { name: true } },
      _count: { select: activeStudents },
      members: { where: { userId }, select: { role: true } },
    },
  });
}

export function myEditedCourses(userId: string) {
  return db.course.findMany({
    where: { editors: { some: { userId } }, status: { not: "ARCHIVED" } },
    orderBy: { title: "asc" },
    select: { id: true, code: true, title: true, status: true },
  });
}

export function myStudentClasses(userId: string) {
  return db.class.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      members: { some: { userId, role: "STUDENT", status: { in: ["ACTIVE", "COMPLETED"] } } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: {
      course: { select: { title: true, summary: true, coverFileId: true } },
      term: { select: { name: true } },
      members: { where: { role: "TEACHER", status: "ACTIVE" }, select: { user: { select: { name: true } } } },
    },
  });
}

export function classStaff(classId: string) {
  return db.classMember.findMany({
    where: { classId, role: { in: ["TEACHER", "ASSISTANT"] }, status: "ACTIVE" },
    orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
}

// ───────────── Catalog (public) ─────────────

const catalogWhere: Prisma.CourseWhereInput = { status: "PUBLISHED", visibility: "CATALOG" };

export function listCatalog(opts: { q?: string; categorySlug?: string }) {
  return db.course.findMany({
    where: {
      ...catalogWhere,
      ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
      ...(opts.q ? { OR: [{ title: { contains: opts.q } }, { summary: { contains: opts.q } }] } : {}),
    },
    orderBy: { title: "asc" },
    take: 100,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      level: true,
      selfEnroll: true,
      coverFileId: true,
      category: { select: { name: true } },
    },
  });
}

export function getCatalogCourse(slug: string) {
  return db.course.findFirst({
    where: { ...catalogWhere, slug },
    include: {
      category: { select: { name: true, slug: true } },
      classes: {
        where: { status: "ACTIVE" },
        orderBy: [{ startDate: "asc" }, { name: "asc" }],
        include: {
          term: { select: { name: true } },
          _count: { select: activeStudents },
          members: { where: { role: "TEACHER", status: "ACTIVE" }, select: { user: { select: { name: true } } } },
        },
      },
    },
  });
}

export function listCatalogCategories() {
  return db.category.findMany({
    where: { courses: { some: catalogWhere } },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });
}
