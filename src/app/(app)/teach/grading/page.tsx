import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { gradingQueue } from "@/features/assessment/grading-queries";
import { getSettings } from "@/features/settings/queries";
import { requireArea } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Grading" };

export default async function GradingQueuePage() {
  const user = await requireArea("teach");
  const [{ attempts, submissions }, { timezone }] = await Promise.all([gradingQueue(user), getSettings("general")]);
  const rows = [
    ...attempts.map((a) => ({
      key: a.id,
      href: `/teach/grading/attempts/${a.id}`,
      student: a.user.name,
      what: a.entry.title,
      kind: "Quiz",
      className: a.class.name,
      at: a.submittedAt,
      late: false,
      detail: `Attempt ${a.number}`,
    })),
    ...submissions.map((s) => ({
      key: s.id,
      href: `/teach/grading/submissions/${s.id}`,
      student: s.user.name,
      what: s.entry.title,
      kind: "Assignment",
      className: s.class.name,
      at: s.submittedAt as Date | null,
      late: s.late,
      detail: s.number > 1 ? `Version ${s.number}` : "",
    })),
  ].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));

  return (
    <>
      <PageHeader title="Grading" description="Work waiting for you across your classes, oldest first." />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="All caught up" description="New submissions and quiz answers that need a teacher will appear here." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Work</TableHead>
                <TableHead className="hidden md:table-cell">Class</TableHead>
                <TableHead className="hidden sm:table-cell">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    <Link href={r.href} className="font-medium hover:underline">{r.student}</Link>
                  </TableCell>
                  <TableCell>
                    {r.what}
                    <span className="block text-xs text-muted-foreground">
                      {r.kind}
                      {r.detail ? ` · ${r.detail}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{r.className}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {r.at ? formatDateTime(r.at, timezone) : "—"}
                    {r.late ? <Badge variant="secondary" className="ml-2 bg-amber-500/15 text-amber-800">Late</Badge> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
