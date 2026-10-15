import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireClassStaff } from "@/features/academics/access";
import { assessmentResults } from "@/features/assessment/grading-queries";
import { getSettings } from "@/features/settings/queries";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Assessment results" };

export default async function AssessmentResultsPage({ params }: PageProps<"/teach/classes/[classId]/assessments/[entryId]">) {
  const { classId, entryId } = await params;
  const { klass } = await requireClassStaff(classId);
  const entry = await db.entry.findFirst({
    where: { id: entryId, type: { in: ["QUIZ", "ASSIGNMENT"] }, unit: { courseId: klass.courseId } },
    select: { id: true, title: true, type: true },
  });
  if (!entry) notFound();
  const [rows, { timezone }] = await Promise.all([assessmentResults(classId, entryId), getSettings("general")]);
  const isQuiz = entry.type === "QUIZ";

  return (
    <div className="grid max-w-4xl gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2">
          <Link href={`/teach/classes/${classId}/assessments`}><ArrowLeft /> Assessments</Link>
        </Button>
        <h2 className="text-lg font-semibold">{entry.title}</h2>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ user, attempts, latestSubmission, grade }) => {
              const latestAttempt = attempts.find((a) => a.status !== "IN_PROGRESS") ?? attempts[0];
              const target = isQuiz
                ? latestAttempt && latestAttempt.status !== "IN_PROGRESS" ? `/teach/grading/attempts/${latestAttempt.id}` : null
                : latestSubmission ? `/teach/grading/submissions/${latestSubmission.id}` : null;
              const needsGrading = isQuiz ? attempts.some((a) => a.status === "NEEDS_GRADING") : latestSubmission?.status === "SUBMITTED";
              const status = isQuiz
                ? attempts.length === 0 ? "Not started" : attempts.some((a) => a.status === "IN_PROGRESS") && attempts.length === 1 ? "In progress" : `${attempts.filter((a) => a.status !== "IN_PROGRESS").length} attempt(s)`
                : latestSubmission ? `Submitted ${formatDateTime(latestSubmission.submittedAt, timezone)}${latestSubmission.late ? " (late)" : ""}` : "Not submitted";
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.name}
                    <span className="block text-xs text-muted-foreground">{user.email}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {status}
                    {needsGrading ? <Badge variant="secondary" className="ml-2 bg-amber-500/15 text-amber-800">To grade</Badge> : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {grade?.score != null ? `${grade.score} / ${grade.maxScore}` : "—"}
                    {grade && !grade.released ? <span className="ml-1 text-xs text-muted-foreground">(not released)</span> : null}
                  </TableCell>
                  <TableCell>
                    {target ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={target}>{needsGrading ? "Grade" : "Review"}</Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
