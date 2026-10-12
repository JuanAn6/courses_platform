"use client";

import { useCallback, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { deleteEntry, reorderEntries, updateEntry } from "@/features/entries/actions";
import { ContentEditor } from "@/features/entries/components/editors";
import { EntryViewer } from "@/features/entries/components/viewers";
import type { FileInfo } from "@/features/entries/queries";
import { publishProblems, referencedFiles, trackingFor, completionThreshold, type AnyEntryContent, type EntryType, type Tracking } from "@/features/entries/registry";
import { RichTextView } from "@/features/entries/rich-text/rich-text-view";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";

type EditableEntry = {
  id: string;
  type: EntryType;
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED";
  required: boolean;
  releaseAt: string;
  dueAt: string;
  unitId: string;
  content: AnyEntryContent;
  tracking: Tracking;
  threshold: number;
};

const initial: ActionState = { status: "idle" };

export function EntryEditorForm({
  entry,
  units,
  files: initialFiles,
  timezone,
}: {
  entry: EditableEntry;
  units: { id: string; title: string; entryIds: string[] }[];
  files: FileInfo[];
  timezone: string;
}) {
  const { state, formAction, onSubmit, pending } = useActionForm(updateEntry, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(state, undefined, { toastErrors: false });

  const [content, setContent] = useState<AnyEntryContent>(entry.content);
  const [files, setFiles] = useState(() => new Map(initialFiles.map((f) => [f.id, f])));
  const addFile = useCallback((f: FileInfo) => setFiles((prev) => new Map(prev).set(f.id, f)), []);
  const [status, setStatus] = useState(entry.status);
  const problems = publishProblems(entry.type, content);

  return (
    <Tabs defaultValue="edit">
      <TabsList className="mb-4">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="edit">
        <form action={formAction} onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1fr_20rem]" noValidate>
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="content" value={JSON.stringify(content)} />
          <div className="grid content-start gap-6">
            {state.status === "error" && !errors?.status ? (
              <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>
            ) : null}
            <Card>
              <CardContent className="grid gap-4">
                <FormField id="title" label="Title" error={errors?.title}>
                  <Input id="title" name="title" defaultValue={entry.title} />
                </FormField>
                <FormField id="description" label="Introduction" error={errors?.description} hint="Optional. Shown above the content.">
                  <Textarea id="description" name="description" rows={2} defaultValue={entry.description} />
                </FormField>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Content</CardTitle></CardHeader>
              <CardContent>
                <ContentEditor type={entry.type} value={content} onChange={(next) => setContent((prev) => (typeof next === "function" ? next(prev) : next))} files={files} onFile={addFile} />
              </CardContent>
            </Card>
          </div>

          <div className="grid content-start gap-6">
            <Card>
              <CardHeader><CardTitle>Publishing</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <FormField id="status" label="Status" error={errors?.status}>
                  <NativeSelect id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}>
                    <option value="DRAFT">Draft (only staff can see it)</option>
                    <option value="PUBLISHED">Published</option>
                  </NativeSelect>
                </FormField>
                {status === "PUBLISHED" && problems.length ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">To publish: {problems.join(" ")}</p>
                ) : null}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="required" defaultChecked={entry.required} className="mt-0.5 size-4 accent-primary" />
                  <span>
                    <span className="font-medium">Required</span>
                    <span className="block text-muted-foreground">Counts toward progress and unit prerequisites.</span>
                  </span>
                </label>
                <FormField id="releaseAt" label="Available from" error={errors?.releaseAt} hint={`Optional. Times are in ${timezone}.`}>
                  <Input id="releaseAt" name="releaseAt" type="datetime-local" defaultValue={entry.releaseAt} />
                </FormField>
                <FormField id="dueAt" label="Due" error={errors?.dueAt} hint="Optional.">
                  <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={entry.dueAt} />
                </FormField>
                <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
              </CardContent>
            </Card>
            <MoveCard entryId={entry.id} unitId={entry.unitId} units={units} />
            <Card>
              <CardHeader><CardTitle>Delete</CardTitle></CardHeader>
              <CardContent>
                <ConfirmButton
                  run={() => deleteEntry({ entryId: entry.id })}
                  label={<><Trash2 /> Delete this content</>}
                  title={`Delete “${entry.title}”?`}
                  description="Students lose access to it and its progress is no longer counted."
                  confirmLabel="Delete"
                  destructive
                />
              </CardContent>
            </Card>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="preview">
        <Card>
          <CardContent>
            <EntryViewer
              entryId={entry.id}
              classId={null}
              type={entry.type}
              content={content}
              files={referencedFiles(entry.type, content).flatMap((id) => (files.get(id) ? [files.get(id)!] : []))}
              tracking={trackingFor(entry.type, content)}
              threshold={completionThreshold(entry.type, content)}
              mode="preview"
              initial={{ status: "NOT_STARTED", percent: 0, position: null }}
              textBody={entry.type === "TEXT" ? <RichTextView doc={(content as { doc: unknown }).doc} /> : undefined}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function MoveCard({ entryId, unitId, units }: { entryId: string; unitId: string; units: { id: string; title: string; entryIds: string[] }[] }) {
  const [target, setTarget] = useState(unitId);
  const [pending, start] = useTransition();
  if (units.length < 2) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unit</CardTitle>
        <CardDescription>Move this content to another unit (it goes to the end).</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <label htmlFor="move-unit" className="sr-only">Unit</label>
        <NativeSelect id="move-unit" value={target} onChange={(e) => setTarget(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.title}</option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          disabled={target === unitId || pending}
          onClick={() =>
            start(async () => {
              const ids = [...(units.find((u) => u.id === target)?.entryIds ?? []).filter((id) => id !== entryId), entryId];
              const res = await reorderEntries({ unitId: target, ids });
              if (res.status === "error") toast.error(res.message);
              else toast.success("Moved.");
            })
          }
        >
          Move
        </Button>
      </CardContent>
    </Card>
  );
}
