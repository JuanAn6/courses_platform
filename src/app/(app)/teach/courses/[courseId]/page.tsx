import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { canEditCourse } from "@/features/academics/access";
import { CourseStatusBadge } from "@/features/academics/components/badges";
import { toBuilderUnits } from "@/features/entries/builder-data";
import { ContentBuilder } from "@/features/entries/components/content-builder";
import { getBuilderData } from "@/features/entries/queries";
import { getSettings } from "@/features/settings/queries";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Course content" };

export default async function CourseBuilderPage({ params }: PageProps<"/teach/courses/[courseId]">) {
  const user = await requireArea("teach");
  const { courseId } = await params;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, code: true, status: true } });
  if (!course) notFound();
  if (!(await canEditCourse(user, courseId))) redirect("/forbidden");
  const [{ units }, { timezone }] = await Promise.all([getBuilderData(courseId), getSettings("general")]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/teach"><ArrowLeft /> Teaching</Link>
      </Button>
      <PageHeader
        title={course.title}
        description="Course content is shared by every class of this course. Classes can hide items or change dates."
      />
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{course.code}</span>
        <CourseStatusBadge status={course.status} />
      </div>
      <div className="max-w-4xl">
        <ContentBuilder courseId={course.id} units={toBuilderUnits(units, timezone)} timezone={timezone} />
      </div>
    </>
  );
}
