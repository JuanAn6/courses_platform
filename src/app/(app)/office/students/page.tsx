import type { Metadata } from "next";
import Link from "next/link";
import { Download, Upload, UserPlus } from "lucide-react";
import type { StudentStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { Pager, searchParam } from "@/components/pager";
import { UserStatusBadge } from "@/components/status-badges";
import { listStudents } from "@/features/students/queries";
import { STUDENT_STATUS_LABELS, STUDENT_STATUSES } from "@/features/students/schemas";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: PageProps<"/office/students">) {
  await requirePermission("students.view");
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const statusParam = searchParam(sp.status);
  const status = STUDENT_STATUSES.includes(statusParam as StudentStatus) ? (statusParam as StudentStatus) : undefined;
  const cursor = searchParam(sp.cursor);
  const { students, nextCursor } = await listStudents({ q, status, cursor });

  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set("q", q);
  if (status) exportQuery.set("status", status);

  return (
    <>
      <PageHeader
        title="Students"
        description="Student records, guardians and documents."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/office/students/export.csv?${exportQuery}`} download>
                <Download /> Export CSV
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/office/students/import">
                <Upload /> Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/office/students/new">
                <UserPlus /> Add student
              </Link>
            </Button>
          </>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search</label>
        <Input id="q" name="q" placeholder="Search name, email, code or ID number" defaultValue={q} />
        <label className="sr-only" htmlFor="status">Status</label>
        <NativeSelect id="status" name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Account</TableHead>
              <TableHead className="hidden md:table-cell">Guardians</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No students match these filters.
                </TableCell>
              </TableRow>
            ) : (
              students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/office/students/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.studentProfile?.studentCode}</TableCell>
                  <TableCell>{s.studentProfile ? STUDENT_STATUS_LABELS[s.studentProfile.status] : null}</TableCell>
                  <TableCell className="hidden md:table-cell"><UserStatusBadge status={s.status} /></TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{s._count.guardians}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pager basePath="/office/students" params={{ q, status }} cursor={cursor} nextCursor={nextCursor} />
    </>
  );
}
