import type { StudentStatus } from "@/generated/prisma/client";
import { STUDENT_EXPORT_COLUMNS, toCsv } from "@/features/students/csv";
import { listStudentsForExport } from "@/features/students/queries";
import { STUDENT_STATUSES } from "@/features/students/schemas";
import { audit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.roles, "students.view")) return new Response("Not found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() || undefined;
  const statusParam = params.get("status") ?? "";
  const status = STUDENT_STATUSES.includes(statusParam as StudentStatus) ? (statusParam as StudentStatus) : undefined;

  const students = await listStudentsForExport({ q, status });
  const csv = toCsv(
    STUDENT_EXPORT_COLUMNS,
    students.map((s) => ({
      ...s.studentProfile,
      name: s.name,
      email: s.email,
      phone: s.phone,
      accountStatus: s.status,
      guardians: s.guardians.map((g) => `${g.guardian.name} <${g.guardian.email}> (${g.relationship})`).join("; "),
    })),
  );
  await audit({ actorId: user.id, action: "student.export", entityType: "User", diff: { count: students.length, q, status } });

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
