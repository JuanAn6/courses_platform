import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { canGradeClass } from "@/features/assessment/student-access";
import { assignmentMaxScore, parseContent } from "@/features/entries/registry";
import { RichTextView } from "@/features/entries/rich-text/rich-text-view";
import { getSettings } from "@/features/settings/queries";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { SubmissionGrader } from "./submission-grader";

export const metadata: Metadata = { title: "Grade submission" };

export default async function GradeSubmissionPage({ params }: PageProps<"/teach/grading/submissions/[submissionId]">) {
  const user = await requireArea("teach");
  const { submissionId } = await params;
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      user: { select: { name: true } },
      class: { select: { name: true } },
      entry: { select: { id: true, title: true, content: true } },
      files: { include: { file: { select: { id: true, originalName: true, size: true } } } },
    },
  });
  if (!submission) notFound();
  if (!(await canGradeClass(user, submission.classId))) redirect("/forbidden");

  const [versions, grade, { timezone }] = await Promise.all([
    db.submission.findMany({
      where: { entryId: submission.entryId, classId: submission.classId, userId: submission.userId },
      orderBy: { number: "desc" },
      select: { id: true, number: true, submittedAt: true, late: true },
    }),
    db.grade.findUnique({ where: { classId_userId_entryId: { classId: submission.classId, userId: submission.userId, entryId: submission.entryId } } }),
    getSettings("general"),
  ]);
  const content = parseContent("ASSIGNMENT", submission.entry.content);
  const isLatest = versions[0]?.id === submission.id;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <div className="grid content-start gap-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href={`/teach/classes/${submission.classId}/assessments/${submission.entryId}`}><ArrowLeft /> {submission.entry.title}</Link>
          </Button>
          <PageHeader
            title={`${submission.user.name} · ${submission.entry.title}`}
            description={`${submission.class.name} · Version ${submission.number} · Submitted ${formatDateTime(submission.submittedAt, timezone)}`}
          />
          <div className="flex flex-wrap gap-2">
            {submission.late ? <Badge variant="secondary" className="bg-amber-500/15 text-amber-800">Late</Badge> : null}
            {!isLatest ? <Badge variant="secondary">Older version</Badge> : null}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Submission</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {submission.text ? <p className="whitespace-pre-line text-sm leading-relaxed">{submission.text}</p> : <p className="text-sm text-muted-foreground">No text.</p>}
            {submission.files.map((f) => (
              <a key={f.file.id} href={`/api/files/${f.file.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline underline-offset-4">
                <FileText className="size-4" aria-hidden /> {f.file.originalName} <span className="text-xs text-muted-foreground">{formatBytes(f.file.size)}</span>
              </a>
            ))}
          </CardContent>
        </Card>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">Instructions</summary>
          <div className="mt-3"><RichTextView doc={content.instructions} /></div>
        </details>

        {versions.length > 1 ? (
          <Card>
            <CardHeader><CardTitle>Versions</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm">
                {versions.map((v) => (
                  <li key={v.id}>
                    {v.id === submission.id ? (
                      <span className="font-medium">Version {v.number} (shown)</span>
                    ) : (
                      <Link href={`/teach/grading/submissions/${v.id}`} className="underline underline-offset-4">Version {v.number}</Link>
                    )}{" "}
                    <span className="text-muted-foreground">· {formatDateTime(v.submittedAt, timezone)}{v.late ? " · late" : ""}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="h-fit">
        <CardHeader><CardTitle>Grade</CardTitle></CardHeader>
        <CardContent>
          <SubmissionGrader
            key={grade?.updatedAt.toISOString() ?? "new"}
            submissionId={submission.id}
            rubric={content.rubric}
            maxScore={assignmentMaxScore(submission.entry.content)}
            initial={{
              score: grade?.score ?? null,
              rubric: (grade?.rubric as Record<string, string> | null) ?? {},
              feedback: grade?.feedback ?? "",
              released: grade ? grade.released : true,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
