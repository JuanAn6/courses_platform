import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ClassStatusBadge } from "@/features/academics/components/badges";
import { CourseCover } from "@/features/academics/components/course-cover";
import { myStudentClasses } from "@/features/academics/queries";
import { requireArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My classes" };

export default async function LearnOverviewPage() {
  const user = await requireArea("learn");
  const classes = await myStudentClasses(user.id);

  return (
    <>
      <PageHeader
        title="My classes"
        description="Your classes, lessons, quizzes and grades."
        actions={
          <Button variant="outline" asChild>
            <Link href="/catalog"><Search /> Browse catalog</Link>
          </Button>
        }
      />
      {classes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="You're not enrolled in any classes yet"
          description="The office enrolls you in your classes. Some courses also let you join from the catalog."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((k) => (
            <Link key={k.id} href={`/learn/classes/${k.id}`} className="group rounded-xl focus-visible:outline-none">
              <Card className="h-full overflow-hidden pt-0 transition-colors group-hover:bg-accent/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CourseCover coverFileId={k.course.coverFileId} title={k.course.title} />
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{k.course.title}</CardTitle>
                    {k.status !== "ACTIVE" ? <ClassStatusBadge status={k.status} /> : null}
                  </div>
                  <CardDescription>
                    {k.name}
                    {k.term ? ` · ${k.term.name}` : ""}
                    {k.members.length ? ` · ${k.members.map((m) => m.user.name).join(", ")}` : ""}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
