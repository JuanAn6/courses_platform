import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { requireClassStaff } from "@/features/academics/access";
import { classAssessments } from "@/features/assessment/grading-queries";
import { EntryIcon } from "@/features/entries/components/entry-icon";

export const metadata: Metadata = { title: "Assessments" };

export default async function ClassAssessmentsPage({ params }: PageProps<"/teach/classes/[classId]/assessments">) {
  const { classId } = await params;
  const { klass } = await requireClassStaff(classId);
  const items = await classAssessments(classId, klass.courseId);

  if (!items.length) {
    return <EmptyState icon={ClipboardCheck} title="No quizzes or assignments yet" description="Add them in the course content; they'll appear here with results." />;
  }
  return (
    <div className="max-w-4xl rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Graded</TableHead>
            <TableHead className="hidden sm:table-cell">Average</TableHead>
            <TableHead>To grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Link href={`/teach/classes/${classId}/assessments/${e.id}`} className="flex items-center gap-2 font-medium hover:underline">
                  <EntryIcon type={e.type} /> {e.title}
                </Link>
                <span className="block pl-6 text-xs text-muted-foreground">
                  {e.unit.title}
                  {e.status === "DRAFT" ? " · Draft" : ""}
                </span>
              </TableCell>
              <TableCell className="tabular-nums">{e.graded}</TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">{e.average === null ? "—" : Math.round(e.average * 100) / 100}</TableCell>
              <TableCell>{e.pending ? <Badge variant="secondary" className="bg-amber-500/15 text-amber-800">{e.pending}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
