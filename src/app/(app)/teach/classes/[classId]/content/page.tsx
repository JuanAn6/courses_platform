import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canEditCourse, requireClassStaff } from "@/features/academics/access";
import { toBuilderUnits } from "@/features/entries/builder-data";
import { ContentBuilder } from "@/features/entries/components/content-builder";
import { buildOutline } from "@/features/entries/outline";
import { getBuilderData, getClassOutlineInput } from "@/features/entries/queries";
import { getSettings } from "@/features/settings/queries";
import { formatDateTime } from "@/lib/format";
import { utcToZonedInput } from "@/lib/timezone";
import { OverrideOutline } from "./override-outline";

export const metadata: Metadata = { title: "Class content" };

export default async function ClassContentPage({ params }: PageProps<"/teach/classes/[classId]/content">) {
  const { classId } = await params;
  const { user, klass, access } = await requireClassStaff(classId);
  const [{ timezone }, outlineInput, classOwn, editsCourse] = await Promise.all([
    getSettings("general"),
    getClassOutlineInput(classId, klass.courseId),
    getBuilderData(klass.courseId, classId),
    canEditCourse(user, klass.courseId),
  ]);
  const courseUnits = outlineInput.filter((u) => !u.classId);
  const staffOutline = buildOutline({ units: courseUnits, now: new Date(), viewer: "staff" });
  const inputById = new Map(courseUnits.flatMap((u) => [[u.id, u.override] as const, ...u.entries.map((e) => [e.id, e.override] as const)]));
  const fmt = (d: Date | null | undefined) => (d ? formatDateTime(d, timezone) : null);

  return (
    <div className="grid max-w-4xl gap-8">
      <section aria-labelledby="course-content-heading" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="course-content-heading" className="text-lg font-semibold">Course content</h2>
            <p className="text-sm text-muted-foreground">
              Shared with every class of {klass.course.title}. {access.isTeacher ? "Hide items or change their dates for this class only." : ""}
            </p>
          </div>
          {editsCourse ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/teach/courses/${klass.courseId}`}><Pencil /> Edit course content</Link>
            </Button>
          ) : null}
        </div>
        <OverrideOutline
          classId={classId}
          canEdit={access.isTeacher}
          timezone={timezone}
          units={staffOutline.units.map((u) => {
            const o = inputById.get(u.id);
            return {
              id: u.id,
              title: u.title,
              hidden: u.hidden,
              availableLabel: fmt(u.availableAt),
              override: { hidden: !!o?.hidden, releaseAt: utcToZonedInput(o?.releaseAt, timezone), dueAt: "" },
              entries: u.entries.map((e) => {
                const eo = inputById.get(e.id);
                return {
                  id: e.id,
                  type: e.type,
                  title: e.title,
                  draft: e.hidden && !eo?.hidden && !u.hidden,
                  hidden: e.hidden,
                  availableLabel: fmt(e.availableAt),
                  dueLabel: fmt(e.dueAt),
                  override: {
                    hidden: !!eo?.hidden,
                    releaseAt: utcToZonedInput(eo?.releaseAt, timezone),
                    dueAt: utcToZonedInput(eo?.dueAt, timezone),
                  },
                };
              }),
            };
          })}
        />
      </section>

      <section aria-labelledby="class-units-heading" className="grid gap-3">
        <div>
          <h2 id="class-units-heading" className="text-lg font-semibold">Class-only units</h2>
          <p className="text-sm text-muted-foreground">Extra material only this class sees, shown after the course content.</p>
        </div>
        {access.isTeacher ? (
          <ContentBuilder
            courseId={klass.courseId}
            classId={classId}
            units={toBuilderUnits(classOwn.units.filter((u) => u.classId === classId), timezone)}
            timezone={timezone}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">View only</CardTitle>
              <CardDescription>Only the class&apos;s teachers can add or edit class-only units.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm">
                {classOwn.units.filter((u) => u.classId === classId).map((u) => (
                  <li key={u.id}>{u.title}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
