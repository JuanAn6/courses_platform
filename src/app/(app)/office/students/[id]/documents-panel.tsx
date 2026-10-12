"use client";

import { useEffect, useRef } from "react";
import { Download, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { deleteStudentDocument, uploadStudentDocument } from "@/features/students/document-actions";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/features/students/schemas";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionState } from "@/lib/actions";
import { DOCUMENT_MIME_TYPES, formatBytes } from "@/lib/files";

type Doc = {
  id: string;
  fileId: string;
  title: string;
  type: keyof typeof DOCUMENT_TYPE_LABELS;
  notes: string | null;
  size: number;
  mime: string;
  uploadedBy: string | null;
  uploadedAt: string;
};

const initial: ActionState = { status: "idle" };

export function DocumentsPanel({ studentId, documents }: { studentId: string; documents: Doc[] }) {
  const { state, formAction, onSubmit, pending } = useActionForm(uploadStudentDocument, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Uploaded.");
      formRef.current?.reset();
    } else if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Confidential: visible to office staff and administrators only.</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <ul className="divide-y">
              {documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[d.type]} · {formatBytes(d.size)} · {d.uploadedAt}
                        {d.uploadedBy ? ` · ${d.uploadedBy}` : ""}
                      </p>
                      {d.notes ? <p className="mt-1 text-sm">{d.notes}</p> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <a href={`/api/files/${d.fileId}`} aria-label={`Download ${d.title}`}>
                        <Download /> Download
                      </a>
                    </Button>
                    <ConfirmButton
                      run={() => deleteStudentDocument({ documentId: d.id })}
                      label={<><Trash2 /><span className="sr-only">Delete {d.title}</span></>}
                      title={`Delete “${d.title}”?`}
                      description="The file is permanently removed."
                      confirmLabel="Delete"
                      destructive
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload a document</CardTitle>
          <CardDescription>PDF, images, Word, Excel or text, up to 10 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
            <input type="hidden" name="studentId" value={studentId} />
            <FormField id="doc-file" label="File" error={errors?.file}>
              <Input id="doc-file" name="file" type="file" accept={Object.keys(DOCUMENT_MIME_TYPES).join(",")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="doc-type" label="Type" error={errors?.type}>
                <NativeSelect id="doc-type" name="type" defaultValue="OTHER">
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="doc-title" label="Title" error={errors?.title} hint="Defaults to the file name.">
                <Input id="doc-title" name="title" />
              </FormField>
            </div>
            <FormField id="doc-notes" label="Notes" error={errors?.notes}>
              <Input id="doc-notes" name="notes" />
            </FormField>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
