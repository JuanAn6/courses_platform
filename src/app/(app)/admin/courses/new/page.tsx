import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CourseForm } from "@/features/academics/components/course-form";
import { listCategoriesFlat } from "@/features/academics/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requirePermission("courses.manage");
  const categories = await listCategoriesFlat();
  return (
    <>
      <PageHeader title="New course" description="Add the cover image, editors and classes after creating it." />
      <Card className="max-w-3xl">
        <CardContent>
          <CourseForm categories={categories} />
        </CardContent>
      </Card>
    </>
  );
}
