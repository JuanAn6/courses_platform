import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { UserStatusBadge } from "@/components/status-badges";
import { getSettings } from "@/features/settings/queries";
import { getStudentRecord } from "@/features/students/queries";
import { STUDENT_STATUS_LABELS } from "@/features/students/schemas";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { AccountPanel } from "./account-panel";
import { DocumentsPanel } from "./documents-panel";
import { EditStudentForm } from "./edit-student-form";
import { GuardiansPanel } from "./guardians-panel";

export const metadata: Metadata = { title: "Student record" };

export default async function StudentRecordPage({ params }: PageProps<"/office/students/[id]">) {
  const actor = await requirePermission("students.viewSensitive");
  const { id } = await params;
  const [student, { timezone }] = await Promise.all([getStudentRecord(id), getSettings("general")]);
  if (!student?.studentProfile) notFound();
  const profile = student.studentProfile;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/office/students">
          <ArrowLeft /> Students
        </Link>
      </Button>
      <PageHeader title={student.name} description={`${profile.studentCode} · ${student.email}`} />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="outline">Enrollment: {STUDENT_STATUS_LABELS[profile.status]}</Badge>
        <UserStatusBadge status={student.status} prefix="Account" />
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="guardians">Guardians ({student.guardians.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({student.documents.length})</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="max-w-3xl">
            <CardContent>
              <EditStudentForm
                userId={student.id}
                defaults={{
                  name: student.name,
                  email: student.email,
                  phone: student.phone,
                  ...profile,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians">
          <GuardiansPanel
            studentId={student.id}
            guardians={student.guardians.map((g) => ({ ...g.guardian, relationship: g.relationship }))}
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel
            studentId={student.id}
            documents={student.documents.map((d) => ({
              id: d.id,
              fileId: d.fileId,
              title: d.title,
              type: d.type,
              notes: d.notes,
              size: d.file.size,
              mime: d.file.mime,
              uploadedBy: d.uploadedBy?.name ?? null,
              uploadedAt: formatDateTime(d.createdAt, timezone),
            }))}
          />
        </TabsContent>

        <TabsContent value="account">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>How the student signs in.</CardDescription>
            </CardHeader>
            <CardContent>
              <AccountPanel
                user={{ id: student.id, status: student.status }}
                lastLogin={student.lastLoginAt ? formatDateTime(student.lastLoginAt, timezone) : null}
                adminLink={hasPermission(actor.roles, "users.manage") ? `/admin/users/${student.id}` : null}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
