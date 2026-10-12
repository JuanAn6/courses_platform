import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireClassViewer } from "@/features/academics/access";
import { ClassStatusBadge } from "@/features/academics/components/badges";
import { CourseCover } from "@/features/academics/components/course-cover";
import { classStaff } from "@/features/academics/queries";
import { ClassOutline, ProgressBar } from "@/features/entries/components/class-outline";
import { getStudentOutline } from "@/features/entries/queries";
import { getSettings } from "@/features/settings/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Class" };

export default async function LearnClassPage({ params }: PageProps<"/learn/classes/[classId]">) {
  const { classId } = await params;
  const { klass, user } = await requireClassViewer(classId);
  const [staff, outline, { timezone }] = await Promise.all([
    classStaff(classId),
    getStudentOutline(classId, klass.courseId, user.id),
    getSettings("general"),
  ]);
  const started = outline.requiredDone > 0;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/learn"><ArrowLeft /> My classes</Link>
      </Button>
      <PageHeader
        title={klass.course.title}
        description={`${klass.name}${klass.term ? ` · ${klass.term.name}` : ""}`}
        actions={
          outline.nextEntryId ? (
            <Button asChild>
              <Link href={`/learn/classes/${classId}/entries/${outline.nextEntryId}`}>
                {started ? "Continue" : "Start"} <ArrowRight />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {klass.status === "COMPLETED" ? <div className="mb-4"><ClassStatusBadge status="COMPLETED" /></div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="grid content-start gap-4">
          {outline.percent !== null ? <ProgressBar percent={outline.percent} label="Your progress" /> : null}
          {outline.units.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState icon={BookOpen} title="No lessons published yet" description="Your teachers will publish units and lessons here." />
              </CardContent>
            </Card>
          ) : (
            <ClassOutline outline={outline} classId={classId} timezone={timezone} />
          )}
        </div>
        <div className="grid content-start gap-6">
          <Card className="overflow-hidden pt-0">
            <CourseCover coverFileId={klass.course.coverFileId} title={klass.course.title} />
            <CardContent className="grid gap-3 text-sm">
              {klass.startDate ? (
                <p>
                  <span className="text-muted-foreground">Dates: </span>
                  {formatDate(klass.startDate, "UTC")}
                  {klass.endDate ? ` – ${formatDate(klass.endDate, "UTC")}` : ""}
                </p>
              ) : null}
              <div>
                <p className="mb-1 text-muted-foreground">Teachers</p>
                <ul className="grid gap-1">
                  {staff.map((s) => (
                    <li key={s.user.id}>
                      {s.user.name}
                      {s.role === "ASSISTANT" ? <span className="text-muted-foreground"> · Assistant</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          {klass.course.description ? (
            <Card>
              <CardHeader><CardTitle>About this course</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed">{klass.course.description}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
