import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { searchParam } from "@/components/pager";
import { ClassStatusBadge, Seats } from "@/features/academics/components/badges";
import { getRoster, listEnrollableClasses, searchEnrollableStudents } from "@/features/academics/queries";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSettings } from "@/features/settings/queries";
import { AddStudents, RosterTable } from "./enrollment-manager";

export const metadata: Metadata = { title: "Enrollments" };

export default async function EnrollmentsPage({ searchParams }: PageProps<"/office/enrollments">) {
  await requirePermission("enrollments.manage");
  const sp = await searchParams;
  const classId = searchParam(sp.classId);
  const q = searchParam(sp.q);

  const [classes, { timezone }] = await Promise.all([listEnrollableClasses(), getSettings("general")]);
  const selected = classId
    ? await db.class.findUnique({
        where: { id: classId },
        include: { course: { select: { title: true } }, term: { select: { name: true } } },
      })
    : null;
  const [roster, candidates] = selected
    ? await Promise.all([getRoster(selected.id), searchEnrollableStudents(selected.id, q)])
    : [[], []];
  const students = roster.filter((m) => m.role === "STUDENT");
  const active = students.filter((m) => m.status === "ACTIVE");

  return (
    <>
      <PageHeader title="Enrollments" description="Enroll, withdraw and move students between classes." />

      <form className="mb-6 flex max-w-2xl flex-wrap gap-2" aria-label="Choose a class">
        <label htmlFor="classId" className="sr-only">Class</label>
        <NativeSelect id="classId" name="classId" defaultValue={classId ?? ""} className="min-w-0 flex-1">
          <option value="">Choose a class…</option>
          {classes.map((k) => (
            <option key={k.id} value={k.id}>
              {k.course.title} — {k.name} ({k.code}){k.term ? ` · ${k.term.name}` : ""}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">Open</Button>
      </form>

      {!selected ? (
        <p className="text-sm text-muted-foreground">Choose a class to manage its students. Only Draft and Active classes accept enrollments.</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {selected.name} <ClassStatusBadge status={selected.status} />
              </CardTitle>
              <CardDescription>
                {selected.course.title}
                {selected.term ? ` · ${selected.term.name}` : ""} · <Seats count={active.length} capacity={selected.capacity} /> ·{" "}
                <Link href={`/admin/classes/${selected.id}`} className="underline underline-offset-4">Class settings</Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RosterTable
                classId={selected.id}
                members={students.map((m) => ({
                  userId: m.user.id,
                  name: m.user.name,
                  email: m.user.email,
                  code: m.user.studentProfile?.studentCode ?? "",
                  status: m.status,
                  since: formatDate(m.enrolledAt, timezone),
                  ended: m.endedAt ? formatDate(m.endedAt, timezone) : null,
                  note: m.note,
                }))}
                targets={classes
                  .filter((k) => k.id !== selected.id)
                  .map((k) => ({ id: k.id, label: `${k.course.title} — ${k.name} (${k.code})`, seatsLeft: k.capacity ? k.capacity - k._count.members : null }))}
              />
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Add students</CardTitle>
              <CardDescription>Active students who aren&apos;t enrolled in this class.</CardDescription>
            </CardHeader>
            <CardContent>
              <AddStudents
                classId={selected.id}
                q={q ?? ""}
                candidates={candidates.map((c) => ({ id: c.id, name: c.name, email: c.email, code: c.studentProfile?.studentCode ?? "" }))}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
