import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ClassStatusBadge, CourseStatusBadge, Seats } from "@/features/academics/components/badges";
import { myEditedCourses, myTeachingClasses } from "@/features/academics/queries";
import { requireArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Teaching" };

export default async function TeachOverviewPage() {
  const user = await requireArea("teach");
  const [classes, courses] = await Promise.all([myTeachingClasses(user.id), myEditedCourses(user.id)]);

  return (
    <>
      <PageHeader title="Teaching" description="Your classes, course content, grading and attendance." />
      <section aria-labelledby="classes-heading" className="mb-8">
        <h2 id="classes-heading" className="mb-3 text-lg font-semibold">My classes</h2>
        {classes.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No classes yet"
            description={
              user.roles.includes("ADMIN")
                ? "You aren't on any class's staff. As an administrator you can open any class from Administration → Classes."
                : "Classes you're assigned to as a teacher or assistant will appear here."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((k) => (
              <Link key={k.id} href={`/teach/classes/${k.id}`} className="group rounded-xl focus-visible:outline-none">
                <Card className="h-full transition-colors group-hover:bg-accent/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{k.name}</CardTitle>
                      <ClassStatusBadge status={k.status} />
                    </div>
                    <CardDescription>
                      {k.course.title}
                      {k.term ? ` · ${k.term.name}` : ""}
                    </CardDescription>
                    <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                      <Seats count={k._count.members} capacity={k.capacity} />
                      <Badge variant="outline">{k.members[0]?.role === "ASSISTANT" ? "Assistant" : "Teacher"}</Badge>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {courses.length ? (
        <section aria-labelledby="courses-heading">
          <h2 id="courses-heading" className="mb-1 text-lg font-semibold">Courses you edit</h2>
          <p className="mb-3 text-sm text-muted-foreground">The course builder for units and lessons arrives with the content engine.</p>
          <ul className="divide-y rounded-lg border">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{c.title}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{c.code}</span>
                </span>
                <CourseStatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
