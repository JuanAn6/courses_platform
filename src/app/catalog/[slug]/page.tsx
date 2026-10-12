import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CourseCover } from "@/features/academics/components/course-cover";
import { getCatalogCourse } from "@/features/academics/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { SelfEnrollButton } from "./self-enroll-button";

export async function generateMetadata({ params }: PageProps<"/catalog/[slug]">): Promise<Metadata> {
  const course = await getCatalogCourse((await params).slug);
  return { title: course?.title ?? "Course", description: course?.summary ?? undefined };
}

export default async function CatalogCoursePage({ params }: PageProps<"/catalog/[slug]">) {
  const { slug } = await params;
  const [course, user] = await Promise.all([getCatalogCourse(slug), getCurrentUser()]);
  if (!course) notFound();

  const memberships = user
    ? await db.classMember.findMany({
        where: { userId: user.id, classId: { in: course.classes.map((k) => k.id) } },
        select: { classId: true, status: true, role: true },
      })
    : [];
  const membershipFor = (classId: string) => memberships.find((m) => m.classId === classId);
  const isStudent = !!user?.roles.includes("STUDENT");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/catalog"><ArrowLeft /> Catalog</Link>
      </Button>
      <PageHeader title={course.title} description={course.summary ?? undefined} />
      <div className="mb-6 flex flex-wrap gap-1">
        {course.category ? <Badge variant="outline">{course.category.name}</Badge> : null}
        {course.level ? <Badge variant="outline">{course.level}</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6">
          <Card className="overflow-hidden pt-0 lg:hidden">
            <CourseCover coverFileId={course.coverFileId} title={course.title} />
          </Card>
          {course.description ? (
            <Card>
              <CardHeader><CardTitle>About this course</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed">{course.description}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Classes</CardTitle></CardHeader>
            <CardContent>
              {course.classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes are running right now.</p>
              ) : (
                <ul className="divide-y">
                  {course.classes.map((k) => {
                    const seatsLeft = k.capacity === null ? null : Math.max(0, k.capacity - k._count.members);
                    const membership = membershipFor(k.id);
                    const enrolled = membership?.role === "STUDENT" && membership.status !== "WITHDRAWN";
                    return (
                      <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-medium">{k.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {k.term ? `${k.term.name} · ` : ""}
                            {k.startDate ? formatDate(k.startDate, "UTC") : "Ongoing"}
                            {k.endDate ? ` – ${formatDate(k.endDate, "UTC")}` : ""}
                            {k.members.length ? ` · ${k.members.map((m) => m.user.name).join(", ")}` : ""}
                            {seatsLeft !== null ? ` · ${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left` : ""}
                          </p>
                        </div>
                        {enrolled ? (
                          <Button variant="outline" asChild>
                            <Link href={`/learn/classes/${k.id}`}>Go to class</Link>
                          </Button>
                        ) : !course.selfEnroll ? (
                          <span className="text-sm text-muted-foreground">Enrollment through the office</span>
                        ) : !user ? (
                          <Button variant="outline" asChild>
                            <Link href={`/login?next=${encodeURIComponent(`/catalog/${course.slug}`)}`}>Sign in to enroll</Link>
                          </Button>
                        ) : !isStudent ? (
                          <span className="text-sm text-muted-foreground">Only students can enroll</span>
                        ) : seatsLeft === 0 ? (
                          <span className="text-sm text-muted-foreground">Full</span>
                        ) : (
                          <SelfEnrollButton classId={k.id} className={k.name} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="hidden h-fit overflow-hidden pt-0 lg:block">
          <CourseCover coverFileId={course.coverFileId} title={course.title} />
        </Card>
      </div>
    </>
  );
}
