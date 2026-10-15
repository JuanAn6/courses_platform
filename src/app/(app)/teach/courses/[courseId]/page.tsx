import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canEditCourse } from "@/features/academics/access";
import { toBuilderUnits } from "@/features/entries/builder-data";
import { ContentBuilder } from "@/features/entries/components/content-builder";
import { getBuilderData } from "@/features/entries/queries";
import { getSettings } from "@/features/settings/queries";
import { requireArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Course content" };

export default async function CourseBuilderPage({ params }: PageProps<"/teach/courses/[courseId]">) {
  const user = await requireArea("teach");
  const { courseId } = await params;
  if (!(await canEditCourse(user, courseId))) redirect("/forbidden");
  const [{ units }, { timezone }] = await Promise.all([getBuilderData(courseId), getSettings("general")]);
  return (
    <div className="max-w-4xl">
      <ContentBuilder courseId={courseId} units={toBuilderUnits(units, timezone)} timezone={timezone} />
    </div>
  );
}
