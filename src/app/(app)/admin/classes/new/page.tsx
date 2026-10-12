import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { searchParam } from "@/components/pager";
import { ClassForm } from "@/features/academics/components/class-form";
import { listCourseOptions, listTerms } from "@/features/academics/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New class" };

export default async function NewClassPage({ searchParams }: PageProps<"/admin/classes/new">) {
  await requirePermission("classes.manage");
  const courseId = searchParam((await searchParams).courseId);
  const [courses, terms] = await Promise.all([listCourseOptions(), listTerms()]);
  return (
    <>
      <PageHeader title="New class" description="Assign teachers and enroll students after creating it." />
      <Card className="max-w-3xl">
        <CardContent>
          <ClassForm defaultCourseId={courseId} courses={courses} terms={terms} />
        </CardContent>
      </Card>
    </>
  );
}
