import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { initials } from "@/lib/format";

export const metadata: Metadata = { title: "My students" };

export default async function GuardianOverviewPage() {
  const user = await requireArea("guardian");
  const links = await db.guardianLink.findMany({
    where: { guardianId: user.id, student: { deletedAt: null } },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          studentProfile: { select: { studentCode: true } },
          memberships: {
            where: { role: "STUDENT", status: "ACTIVE", class: { status: { in: ["ACTIVE", "COMPLETED"] } } },
            select: { class: { select: { id: true, name: true, course: { select: { title: true } } } } },
          },
        },
      },
    },
    orderBy: { student: { name: "asc" } },
  });

  return (
    <>
      <PageHeader title="My students" description="Progress, grades and attendance of the students linked to you." />
      {links.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students linked"
          description="Ask the office to link your account to your student."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {links.map(({ student, relationship }) => (
            <Card key={student.id}>
              <CardHeader className="flex flex-row items-center gap-3">
                <Avatar>
                  <AvatarFallback>{initials(student.name)}</AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <CardTitle>{student.name}</CardTitle>
                  <CardDescription>
                    {relationship}
                    {student.studentProfile ? ` · ${student.studentProfile.studentCode}` : ""}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-1 text-sm text-muted-foreground">Classes</p>
                {student.memberships.length === 0 ? (
                  <p className="text-sm">Not enrolled in any class.</p>
                ) : (
                  <ul className="grid gap-1 text-sm">
                    {student.memberships.map(({ class: k }) => (
                      <li key={k.id}>
                        {k.course.title} <span className="text-muted-foreground">· {k.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
