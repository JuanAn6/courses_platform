import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TabLinks } from "@/components/tab-links";
import { canEditCourse } from "@/features/academics/access";
import { CourseStatusBadge } from "@/features/academics/components/badges";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function CourseAuthoringLayout({ children, params }: LayoutProps<"/teach/courses/[courseId]">) {
  const user = await requireArea("teach");
  const { courseId } = await params;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, code: true, status: true } });
  if (!course) notFound();
  if (!(await canEditCourse(user, courseId))) redirect("/forbidden");
  const base = `/teach/courses/${courseId}`;
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/teach"><ArrowLeft /> Teaching</Link>
      </Button>
      <PageHeader title={course.title} description="Shared by every class of this course. Classes can hide items or change dates." />
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{course.code}</span>
        <CourseStatusBadge status={course.status} />
      </div>
      <TabLinks
        label="Course authoring"
        tabs={[
          { href: base, label: "Content" },
          { href: `${base}/questions`, label: "Question bank" },
        ]}
      />
      {children}
    </>
  );
}
