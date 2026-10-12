import "server-only";
import type { Prisma, StudentStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const STUDENTS_PAGE_SIZE = 25;

const studentWhere = (opts: { q?: string; status?: StudentStatus }): Prisma.UserWhereInput => ({
  deletedAt: null,
  roles: { some: { role: "STUDENT" } },
  studentProfile: { is: opts.status ? { status: opts.status } : {} },
  ...(opts.q
    ? {
        OR: [
          { name: { contains: opts.q } },
          { email: { contains: opts.q } },
          { studentProfile: { is: { studentCode: { contains: opts.q } } } },
          { studentProfile: { is: { documentId: { contains: opts.q } } } },
        ],
      }
    : {}),
});

export async function listStudents(opts: { q?: string; status?: StudentStatus; cursor?: string }) {
  const rows = await db.user.findMany({
    where: studentWhere(opts),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: STUDENTS_PAGE_SIZE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      studentProfile: { select: { studentCode: true, status: true, documentId: true } },
      _count: { select: { guardians: true } },
    },
  });
  return {
    students: rows.slice(0, STUDENTS_PAGE_SIZE),
    nextCursor: rows.length > STUDENTS_PAGE_SIZE ? rows[STUDENTS_PAGE_SIZE - 1].id : null,
  };
}

/** Everything for the export (no medical notes). */
export async function listStudentsForExport(opts: { q?: string; status?: StudentStatus }) {
  return db.user.findMany({
    where: studentWhere(opts),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      name: true,
      email: true,
      phone: true,
      status: true,
      studentProfile: {
        select: {
          studentCode: true,
          status: true,
          birthDate: true,
          documentId: true,
          address: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          enrollmentDate: true,
        },
      },
      guardians: { select: { relationship: true, guardian: { select: { name: true, email: true } } } },
    },
  });
}

export async function getStudentRecord(userId: string) {
  return db.user.findFirst({
    where: { id: userId, deletedAt: null, studentProfile: { isNot: null } },
    include: {
      studentProfile: true,
      guardians: {
        where: { guardian: { deletedAt: null } },
        include: { guardian: { select: { id: true, name: true, email: true, phone: true, status: true } } },
        orderBy: { createdAt: "asc" },
      },
      documents: {
        include: { file: true, uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export type StudentRecord = NonNullable<Awaited<ReturnType<typeof getStudentRecord>>>;
