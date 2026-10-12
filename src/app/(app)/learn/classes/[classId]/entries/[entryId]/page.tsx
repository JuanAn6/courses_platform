import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireClassViewer } from "@/features/academics/access";
import { EntryViewer } from "@/features/entries/components/viewers";
import { findEntry, neighbors } from "@/features/entries/outline";
import { getEntry, getFilesInfo, getProgress, getStudentOutline } from "@/features/entries/queries";
import { completionThreshold, ENTRY_TYPE_INFO, parseContent, referencedFiles, trackingFor, type EntryType } from "@/features/entries/registry";
import { RichTextView } from "@/features/entries/rich-text/rich-text-view";
import { getSettings } from "@/features/settings/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Lesson" };

export default async function EntryPlayerPage({ params }: PageProps<"/learn/classes/[classId]/entries/[entryId]">) {
  const { classId, entryId } = await params;
  const { klass, user } = await requireClassViewer(classId);
  const outline = await getStudentOutline(classId, klass.courseId, user.id);
  const found = findEntry(outline, entryId);
  if (!found) notFound();
  if (found.entry.locked) redirect(`/learn/classes/${classId}`);

  const [entry, progress, { timezone }] = await Promise.all([getEntry(entryId), getProgress(user.id, entryId, classId), getSettings("general")]);
  if (!entry) notFound();
  const type = entry.type as EntryType;
  const content = parseContent(type, entry.content);
  const files = await getFilesInfo(referencedFiles(type, content));
  const { previous, next } = neighbors(outline, entryId);

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/learn/classes/${classId}`}><ArrowLeft /> {klass.course.title}</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          {found.unit.title} · {ENTRY_TYPE_INFO[type].label}
          {found.entry.dueAt ? ` · Due ${formatDateTime(found.entry.dueAt, timezone)}` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{entry.title}</h1>
        {entry.description ? <p className="mt-2 whitespace-pre-line text-muted-foreground">{entry.description}</p> : null}
      </div>

      <Card>
        <CardContent>
          <EntryViewer
            entryId={entry.id}
            classId={classId}
            type={type}
            content={content}
            files={files}
            tracking={trackingFor(type, content)}
            threshold={completionThreshold(type, content)}
            mode={klass.status === "ACTIVE" ? "student" : "preview"}
            initial={{ status: progress?.status ?? "NOT_STARTED", percent: progress?.percent ?? 0, position: progress?.lastPosition ?? null }}
            textBody={type === "TEXT" ? <RichTextView doc={(content as { doc: unknown }).doc} /> : undefined}
          />
        </CardContent>
      </Card>

      <nav className="flex justify-between gap-2" aria-label="Lessons">
        {previous ? (
          <Button variant="outline" asChild={!previous.locked} disabled={previous.locked}>
            {previous.locked ? <span><ChevronLeft /> {previous.title}</span> : <Link href={`/learn/classes/${classId}/entries/${previous.id}`}><ChevronLeft /> {previous.title}</Link>}
          </Button>
        ) : <span />}
        {next ? (
          next.locked ? (
            <Button variant="outline" disabled>Next is locked</Button>
          ) : (
            <Button asChild>
              <Link href={`/learn/classes/${classId}/entries/${next.id}`}>{next.title} <ChevronRight /></Link>
            </Button>
          )
        ) : (
          <Button variant="outline" asChild>
            <Link href={`/learn/classes/${classId}`}>Back to class</Link>
          </Button>
        )}
      </nav>
    </div>
  );
}
