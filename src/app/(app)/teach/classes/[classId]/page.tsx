import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { requireClassStaff } from "@/features/academics/access";
import { ClassStatusBadge, Seats } from "@/features/academics/components/badges";
import { classStaff, getRoster } from "@/features/academics/queries";
import { getSettings } from "@/features/settings/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Class" };

export default async function TeachClassPage({ params }: PageProps<"/teach/classes/[classId]">) {
  const { classId } = await params;
  const { klass } = await requireClassStaff(classId);
  const [roster, staff, { timezone }] = await Promise.all([getRoster(classId), classStaff(classId), getSettings("general")]);
  const students = roster.filter((m) => m.role === "STUDENT" && m.status === "ACTIVE");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/teach"><ArrowLeft /> My classes</Link>
      </Button>
      <PageHeader
        title={klass.name}
        description={`${klass.course.title}${klass.term ? ` · ${klass.term.name}` : ""} · ${klass.code}`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <ClassStatusBadge status={klass.status} />
        {klass.startDate ? (
          <span>
            {formatDate(klass.startDate, "UTC")}
            {klass.endDate ? ` – ${formatDate(klass.endDate, "UTC")}` : ""}
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              <Seats count={students.length} capacity={klass.capacity} /> enrolled. The office manages enrollments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="hidden sm:table-cell">Code</TableHead>
                      <TableHead className="hidden sm:table-cell">Enrolled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          {m.user.name}
                          <div className="text-xs text-muted-foreground">{m.user.email}</div>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs sm:table-cell">{m.user.studentProfile?.studentCode}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(m.enrolledAt, timezone)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {staff.map((s) => (
                <li key={s.user.id} className="flex items-center justify-between gap-2">
                  {s.user.name}
                  <Badge variant="outline">{s.role === "TEACHER" ? "Teacher" : "Assistant"}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
