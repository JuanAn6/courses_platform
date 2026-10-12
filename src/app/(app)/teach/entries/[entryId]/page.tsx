import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { canEditUnit } from "@/features/entries/access";
import { getEntryForEdit } from "@/features/entries/queries";
import { ENTRY_TYPE_INFO, parseContent, trackingFor, completionThreshold, type EntryType } from "@/features/entries/registry";
import { getSettings } from "@/features/settings/queries";
import { requireArea } from "@/lib/auth/session";
import { utcToZonedInput } from "@/lib/timezone";
import { EntryEditorForm } from "./entry-editor-form";

export const metadata: Metadata = { title: "Edit content" };

export default async function EntryEditorPage({ params }: PageProps<"/teach/entries/[entryId]">) {
  const user = await requireArea("teach");
  const { entryId } = await params;
  const data = await getEntryForEdit(entryId);
  if (!data) notFound();
  const { entry, units, files } = data;
  if (!(await canEditUnit(user, entry.unit))) redirect("/forbidden");
  const { timezone } = await getSettings("general");

  const type = entry.type as EntryType;
  const backHref = entry.unit.classId ? `/teach/classes/${entry.unit.classId}/content` : `/teach/courses/${entry.unit.courseId}`;
  const scope = entry.unit.class ? `${entry.unit.class.name} (class only)` : entry.unit.course.title;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href={backHref}><ArrowLeft /> {scope}</Link>
      </Button>
      <PageHeader title={entry.title} description={`${ENTRY_TYPE_INFO[type].label} · ${entry.unit.title}`} />
      <EntryEditorForm
        timezone={timezone}
        entry={{
          id: entry.id,
          type,
          title: entry.title,
          description: entry.description ?? "",
          status: entry.status,
          required: entry.required,
          releaseAt: utcToZonedInput(entry.releaseAt, timezone),
          dueAt: utcToZonedInput(entry.dueAt, timezone),
          unitId: entry.unitId,
          content: parseContent(type, entry.content),
          tracking: trackingFor(type, entry.content),
          threshold: completionThreshold(type, entry.content),
        }}
        units={units.map((u) => ({ id: u.id, title: u.title, entryIds: u.entries.map((e) => e.id) }))}
        files={files}
      />
    </>
  );
}
