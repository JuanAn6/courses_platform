import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { myStudentClasses } from "@/features/academics/queries";
import { quizSettingsSchema } from "@/features/assessment/quiz";
import { EntryIcon } from "@/features/entries/components/entry-icon";
import { getStudentOutline } from "@/features/entries/queries";
import { getSettings } from "@/features/settings/queries";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Grades" };

export default async function StudentGradesPage() {
  const user = await requireArea("learn");
  const [classes, { timezone }] = await Promise.all([myStudentClasses(user.id), getSettings("general")]);
  const now = new Date();

  const sections = await Promise.all(
    classes.map(async (k) => {
      const outline = await getStudentOutline(k.id, k.courseId, user.id, now);
      const gradable = outline.units.flatMap((u) => u.entries).filter((e) => e.type === "QUIZ" || e.type === "ASSIGNMENT");
      const [grades, entries] = await Promise.all([
        db.grade.findMany({ where: { classId: k.id, userId: user.id, entryId: { in: gradable.map((e) => e.id) } } }),
        db.entry.findMany({ where: { id: { in: gradable.map((e) => e.id) } }, select: { id: true, content: true } }),
      ]);
      const contentById = new Map(entries.map((e) => [e.id, e.content]));
      const rows = gradable.map((e) => {
        const g = grades.find((x) => x.entryId === e.id);
        let visible = !!g && g.released && g.score !== null;
        if (visible && e.type === "QUIZ") {
          const settings = quizSettingsSchema.parse((contentById.get(e.id) as { settings?: unknown } | undefined)?.settings ?? {});
          if (settings.showResults === "after_due" && e.dueAt && now < e.dueAt) visible = false;
        }
        return { entry: e, grade: visible ? g! : null, pending: !!g && !visible };
      });
      const earned = rows.reduce((s, r) => s + (r.grade?.score ?? 0), 0);
      const possible = rows.reduce((s, r) => s + (r.grade ? r.grade.maxScore : 0), 0);
      return { klass: k, rows, earned, possible };
    }),
  );
  const withRows = sections.filter((s) => s.rows.length);

  return (
    <>
      <PageHeader title="Grades" description="Scores and feedback from your quizzes and assignments." />
      {withRows.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No graded work yet" description="Quizzes and assignments will appear here." />
      ) : (
        <div className="grid max-w-4xl gap-6">
          {withRows.map(({ klass, rows, earned, possible }) => (
            <Card key={klass.id}>
              <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
                <CardTitle>{klass.course.title}</CardTitle>
                {possible ? (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    So far: {Math.round(earned * 100) / 100} / {Math.round(possible * 100) / 100} ({Math.round((earned / possible) * 100)}%)
                  </span>
                ) : null}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead className="hidden sm:table-cell">Due</TableHead>
                      <TableHead className="w-32 text-right">Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ entry, grade, pending }) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Link href={`/learn/classes/${klass.id}/entries/${entry.id}`} className="flex items-center gap-2 hover:underline">
                            <EntryIcon type={entry.type} /> {entry.title}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{entry.dueAt ? formatDateTime(entry.dueAt, timezone) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {grade ? `${grade.score} / ${grade.maxScore}` : pending ? <span className="text-muted-foreground">Pending</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
