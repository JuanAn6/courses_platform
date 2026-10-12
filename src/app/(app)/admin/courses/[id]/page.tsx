import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, LayoutList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ClassStatusBadge, CourseStatusBadge, Seats } from "@/features/academics/components/badges";
import { CourseCover } from "@/features/academics/components/course-cover";
import { CourseForm } from "@/features/academics/components/course-form";
import { getCourseAdmin, listCategoriesFlat, listUsersWithRoles } from "@/features/academics/queries";
import { requirePermission } from "@/lib/auth/session";
import { CloneCourseForm, CoverForm, EditorsPanel } from "./course-panels";

export const metadata: Metadata = { title: "Course" };

export default async function CourseDetailPage({ params }: PageProps<"/admin/courses/[id]">) {
  await requirePermission("courses.manage");
  const { id } = await params;
  const [course, categories, teachers] = await Promise.all([
    getCourseAdmin(id),
    listCategoriesFlat(),
    listUsersWithRoles(["TEACHER"]),
  ]);
  if (!course) notFound();

  const isPublic = course.status === "PUBLISHED" && course.visibility === "CATALOG";

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/courses"><ArrowLeft /> Courses</Link>
      </Button>
      <PageHeader
        title={course.title}
        description={course.code}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/teach/courses/${course.id}`}><LayoutList /> Edit content</Link>
            </Button>
            {isPublic ? (
              <Button variant="outline" asChild>
                <Link href={`/catalog/${course.slug}`}><ExternalLink /> View in catalog</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-6"><CourseStatusBadge status={course.status} /></div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <CourseForm course={course} categories={categories} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle>Classes</CardTitle>
                <CardDescription>Deliveries of this course to groups of students.</CardDescription>
              </div>
              <Button size="sm" asChild>
                <Link href={`/admin/classes/new?courseId=${course.id}`}><Plus /> New class</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {course.classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes yet.</p>
              ) : (
                <ul className="divide-y">
                  {course.classes.map((k) => (
                    <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        <Link href={`/admin/classes/${k.id}`} className="font-medium hover:underline">{k.name}</Link>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{k.code}</span>
                        {k.term ? <span className="ml-2 text-muted-foreground">· {k.term.name}</span> : null}
                      </span>
                      <span className="flex items-center gap-3">
                        <Seats count={k._count.members} capacity={k.capacity} />
                        <ClassStatusBadge status={k.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card className="overflow-hidden pt-0">
            <CourseCover coverFileId={course.coverFileId} title={course.title} />
            <CardContent>
              <CoverForm courseId={course.id} hasCover={!!course.coverFileId} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Editors</CardTitle>
              <CardDescription>Teachers who can edit this course&apos;s content.</CardDescription>
            </CardHeader>
            <CardContent>
              <EditorsPanel
                courseId={course.id}
                editors={course.editors.map((e) => e.user)}
                teachers={teachers.map(({ id, name, email }) => ({ id, name, email }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Duplicate</CardTitle>
              <CardDescription>Copies details, editors and content (units and lessons) into a new draft course. Classes aren&apos;t copied.</CardDescription>
            </CardHeader>
            <CardContent>
              <CloneCourseForm courseId={course.id} title={course.title} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
