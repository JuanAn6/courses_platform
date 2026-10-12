import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireClassStaff } from "@/features/academics/access";
import { Seats } from "@/features/academics/components/badges";
import { classStaff, getRoster } from "@/features/academics/queries";
import { getClassProgress } from "@/features/entries/queries";
import { getSettings } from "@/features/settings/queries";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Class" };

export default async function TeachClassPage({ params }: PageProps<"/teach/classes/[classId]">) {
  const { classId } = await params;
  const { klass } = await requireClassStaff(classId);
  const [roster, staff, { timezone }] = await Promise.all([getRoster(classId), classStaff(classId), getSettings("general")]);
  const students = roster.filter((m) => m.role === "STUDENT" && m.status === "ACTIVE");
  const progress = await getClassProgress(classId, klass.courseId, students.map((s) => s.user.id));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>
            <Seats count={students.length} capacity={klass.capacity} /> enrolled. Progress counts required, published content.
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
                    <TableHead className="w-48">Progress</TableHead>
                    <TableHead className="hidden lg:table-cell">Last activity</TableHead>
                    <TableHead className="hidden sm:table-cell">Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((m) => {
                    const p = progress.get(m.user.id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          {m.user.name}
                          <div className="text-xs text-muted-foreground">{m.user.email}</div>
                        </TableCell>
                        <TableCell>
                          {p && p.percent !== null ? (
                            <div className="flex items-center gap-2" aria-label={`${p.percent}% complete`}>
                              <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                                <div className="h-full bg-primary" style={{ width: `${p.percent}%` }} />
                              </div>
                              <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                                {p.done}/{p.total}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No required content</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {p?.lastActivity ? formatDateTime(p.lastActivity, timezone) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(m.enrolledAt, timezone)}</TableCell>
                      </TableRow>
                    );
                  })}
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
  );
}
