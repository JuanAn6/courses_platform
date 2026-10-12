import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ClassStatusBadge, Seats } from "@/features/academics/components/badges";
import { ClassForm } from "@/features/academics/components/class-form";
import { getClassAdmin, listCourseOptions, listTerms, listUsersWithRoles } from "@/features/academics/queries";
import { requirePermission } from "@/lib/auth/session";
import { CloneClassForm, StaffPanel } from "./class-panels";

export const metadata: Metadata = { title: "Class" };

export default async function ClassDetailPage({ params }: PageProps<"/admin/classes/[id]">) {
  await requirePermission("classes.manage");
  const { id } = await params;
  const [klass, courses, terms, staffCandidates] = await Promise.all([
    getClassAdmin(id),
    listCourseOptions(),
    listTerms(),
    listUsersWithRoles(["TEACHER", "ASSISTANT"]),
  ]);
  if (!klass) notFound();

  const staff = klass.members.filter((m) => m.role !== "STUDENT" && m.status === "ACTIVE");
  const students = klass.members.filter((m) => m.role === "STUDENT" && m.status === "ACTIVE");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/classes"><ArrowLeft /> Classes</Link>
      </Button>
      <PageHeader
        title={klass.name}
        description={`${klass.code} · ${klass.course.title}${klass.term ? ` · ${klass.term.name}` : ""}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/teach/classes/${klass.id}`}>Open as teacher</Link>
          </Button>
        }
      />
      <div className="mb-6"><ClassStatusBadge status={klass.status} /></div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <ClassForm klass={klass} courses={courses} terms={terms} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle>Students</CardTitle>
                <CardDescription>
                  <Seats count={students.length} capacity={klass.capacity} /> enrolled
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/office/enrollments?classId=${klass.id}`}><Users /> Manage enrollments</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
              ) : (
                <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {students.map((m) => (
                    <li key={m.id}>
                      {m.user.name}
                      {m.user.studentProfile ? (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{m.user.studentProfile.studentCode}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff</CardTitle>
              <CardDescription>Teachers manage the class; assistants help with grading and attendance.</CardDescription>
            </CardHeader>
            <CardContent>
              <StaffPanel
                classId={klass.id}
                staff={staff.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role as "TEACHER" | "ASSISTANT" }))}
                candidates={staffCandidates.map((u) => ({ id: u.id, name: u.name, roles: u.roles.map((r) => r.role) }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Duplicate for a new term</CardTitle>
              <CardDescription>Copies the course, staff and settings into a new draft class, without students.</CardDescription>
            </CardHeader>
            <CardContent>
              <CloneClassForm classId={klass.id} name={klass.name} terms={terms} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
