"use client";

import { useEffect, useTransition } from "react";
import { ArrowDown, ArrowUp, FileText, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { formatBytes } from "@/lib/files";
import { retryConversion } from "../actions";
import { EMBED_PROVIDERS, toEmbedUrl, videoEmbedUrl } from "../embeds";
import type { FileInfo } from "../queries";
import type { EntryContent, EntryType } from "../registry";
import { RichTextEditor } from "../rich-text/rich-text-editor";
import { FilePicker } from "./file-picker";
import type { UploadedFile } from "./use-upload";

type Props<T extends EntryType> = {
  value: EntryContent<T>;
  /** Accepts a value or an updater (like setState), so consecutive uploads don't overwrite each other. */
  onChange: (next: EntryContent<T> | ((prev: EntryContent<T>) => EntryContent<T>)) => void;
  files: Map<string, FileInfo>;
  onFile: (file: FileInfo) => void;
};

const asInfo = (f: UploadedFile): FileInfo => ({ ...f, pdfFileId: null, error: null });

/** Edits the type-specific part of an entry. */
export function ContentEditor({ type, ...props }: { type: EntryType } & Props<EntryType>) {
  switch (type) {
    case "TEXT":
      return <TextEditor {...(props as Props<"TEXT">)} />;
    case "VIDEO":
      return <VideoEditor {...(props as Props<"VIDEO">)} />;
    case "AUDIO":
      return <AudioEditor {...(props as Props<"AUDIO">)} />;
    case "DOCUMENT":
      return <DocumentEditor {...(props as Props<"DOCUMENT">)} />;
    case "PRESENTATION":
      return <PresentationEditor {...(props as Props<"PRESENTATION">)} />;
    case "LINK":
      return <LinkEditor {...(props as Props<"LINK">)} />;
    case "EMBED":
      return <EmbedEditor {...(props as Props<"EMBED">)} />;
  }
}

function TextEditor({ value, onChange }: Props<"TEXT">) {
  return <RichTextEditor value={value.doc} onChange={(doc) => onChange({ doc })} />;
}

function SourceToggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div role="radiogroup" aria-label="Source" className="flex flex-wrap gap-4 text-sm">
      {options.map(([v, label]) => (
        <label key={v} className="flex items-center gap-2">
          <input type="radio" checked={value === v} onChange={() => onChange(v)} className="accent-primary" />
          {label}
        </label>
      ))}
    </div>
  );
}

function FileRow({ file, onRemove, extra }: { file: FileInfo | undefined; onRemove?: () => void; extra?: React.ReactNode }) {
  if (!file) return <p className="text-sm text-muted-foreground">File unavailable.</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{file.name}</span>
        <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
      <span className="flex items-center gap-1">
        {extra}
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${file.name}`}>
            <Trash2 />
          </Button>
        ) : null}
      </span>
    </div>
  );
}

function CompletionField({ value, onChange, noun }: { value: number; onChange: (v: number) => void; noun: string }) {
  return (
    <FormField id="completionPercent" label="Counts as completed after" hint={`Percentage of the ${noun} the student must play.`}>
      <div className="flex items-center gap-2">
        <Input
          id="completionPercent"
          type="number"
          min={10}
          max={100}
          value={value}
          onChange={(e) => onChange(Math.min(100, Math.max(10, Number(e.target.value) || 90)))}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
    </FormField>
  );
}

function VideoEditor({ value, onChange, files, onFile }: Props<"VIDEO">) {
  const embed = value.url ? videoEmbedUrl(value.url) : null;
  return (
    <div className="grid gap-4">
      <SourceToggle
        value={value.source}
        onChange={(source) => onChange({ ...value, source: source as "file" | "url" })}
        options={[["file", "Upload a video"], ["url", "YouTube or Vimeo link"]]}
      />
      {value.source === "file" ? (
        <>
          {value.fileId ? (
            <>
              <video src={`/api/files/${value.fileId}`} controls preload="metadata" className="aspect-video w-full rounded-md bg-black" />
              <FileRow file={files.get(value.fileId)} onRemove={() => onChange({ ...value, fileId: null })} />
            </>
          ) : (
            <FilePicker kind="video" label="Upload video" onUploaded={(f) => { onFile(asInfo(f)); onChange({ ...value, fileId: f.id }); }} />
          )}
          <CompletionField value={value.completionPercent} onChange={(completionPercent) => onChange({ ...value, completionPercent })} noun="video" />
        </>
      ) : (
        <>
          <FormField id="videoUrl" label="Video link" error={value.url && !embed ? "Use a YouTube or Vimeo link." : undefined}>
            <Input id="videoUrl" value={value.url ?? ""} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => onChange({ ...value, url: e.target.value })} />
          </FormField>
          {embed ? (
            <iframe src={embed} title="Video preview" className="aspect-video w-full rounded-md border" allow="encrypted-media; picture-in-picture; fullscreen" />
          ) : null}
          <p className="text-xs text-muted-foreground">Students mark linked videos as done themselves.</p>
        </>
      )}
    </div>
  );
}

function AudioEditor({ value, onChange, files, onFile }: Props<"AUDIO">) {
  return (
    <div className="grid gap-4">
      {value.fileId ? (
        <>
          <audio src={`/api/files/${value.fileId}`} controls preload="metadata" className="w-full" />
          <FileRow file={files.get(value.fileId)} onRemove={() => onChange({ ...value, fileId: null })} />
        </>
      ) : (
        <FilePicker kind="audio" label="Upload audio" onUploaded={(f) => { onFile(asInfo(f)); onChange({ ...value, fileId: f.id }); }} />
      )}
      <CompletionField value={value.completionPercent} onChange={(completionPercent) => onChange({ ...value, completionPercent })} noun="recording" />
    </div>
  );
}

function DocumentEditor({ value, onChange, files, onFile }: Props<"DOCUMENT">) {
  const move = (i: number, d: number) => {
    const next = [...value.fileIds];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange({ fileIds: next });
  };
  return (
    <div className="grid gap-3">
      {value.fileIds.length === 0 ? <p className="text-sm text-muted-foreground">No files yet.</p> : null}
      {value.fileIds.map((id, i) => (
        <FileRow
          key={id}
          file={files.get(id)}
          onRemove={() => onChange({ fileIds: value.fileIds.filter((f) => f !== id) })}
          extra={
            <>
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === value.fileIds.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
            </>
          }
        />
      ))}
      <FilePicker
        kind="document"
        label="Add files"
        multiple
        onUploaded={(f) => {
          onFile(asInfo(f));
          onChange((prev) => ({ fileIds: [...prev.fileIds, f.id] }));
        }}
      />
    </div>
  );
}

function useConversionStatus(file: FileInfo | undefined, onFile: (f: FileInfo) => void) {
  useEffect(() => {
    if (!file || file.status !== "PROCESSING") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/files/${file.id}/status`);
      if (!res.ok) return;
      const s = (await res.json()) as { status: FileInfo["status"]; pdfFileId: string | null; error: string | null };
      if (s.status !== "PROCESSING") onFile({ ...file, ...s });
    }, 3000);
    return () => clearInterval(timer);
  }, [file, onFile]);
}

function PresentationEditor({ value, onChange, files, onFile }: Props<"PRESENTATION">) {
  const file = value.fileId ? files.get(value.fileId) : undefined;
  useConversionStatus(file, onFile);
  const [retrying, startRetry] = useTransition();
  const embed = value.url ? toEmbedUrl(value.url) : null;
  const pdfId = file ? (file.mime === "application/pdf" ? file.id : file.pdfFileId) : null;

  return (
    <div className="grid gap-4">
      <SourceToggle
        value={value.source}
        onChange={(source) => onChange({ ...value, source: source as "file" | "url" })}
        options={[["file", "Upload PDF or PowerPoint"], ["url", "Google Slides link"]]}
      />
      {value.source === "file" ? (
        value.fileId ? (
          <>
            <FileRow file={file} onRemove={() => onChange({ ...value, fileId: null })} />
            {file?.status === "PROCESSING" ? (
              <p className="text-sm text-muted-foreground" role="status">Converting to slides… this can take a minute.</p>
            ) : file?.status === "FAILED" ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
                {file.error ?? "Conversion failed."}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={retrying}
                  onClick={() =>
                    startRetry(async () => {
                      const res = await retryConversion({ fileId: file.id });
                      if (res.status === "error") toast.error(res.message);
                      else onFile({ ...file, status: "PROCESSING", error: null });
                    })
                  }
                >
                  <RefreshCw /> Try again
                </Button>
              </div>
            ) : pdfId ? (
              <p className="text-sm text-muted-foreground">Ready. Use Preview to page through the slides.</p>
            ) : null}
          </>
        ) : (
          <FilePicker kind="presentation" label="Upload slides" onUploaded={(f) => { onFile(asInfo(f)); onChange({ ...value, fileId: f.id }); }} />
        )
      ) : (
        <>
          <FormField id="slidesUrl" label="Google Slides link" error={value.url && !embed ? "Use a Google Slides (or Docs) link." : undefined} hint="Share the presentation so anyone with the link can view it.">
            <Input id="slidesUrl" value={value.url ?? ""} placeholder="https://docs.google.com/presentation/d/…" onChange={(e) => onChange({ ...value, url: e.target.value })} />
          </FormField>
          {embed ? <iframe src={embed} title="Slides preview" className="aspect-video w-full rounded-md border" allowFullScreen /> : null}
        </>
      )}
    </div>
  );
}

function LinkEditor({ value, onChange }: Props<"LINK">) {
  return (
    <FormField id="linkUrl" label="Web address" hint="Opens in a new tab. Opening it counts as completed.">
      <Input id="linkUrl" type="url" value={value.url ?? ""} placeholder="https://…" onChange={(e) => onChange({ url: e.target.value })} />
    </FormField>
  );
}

function EmbedEditor({ value, onChange }: Props<"EMBED">) {
  const embed = value.url ? toEmbedUrl(value.url) : null;
  return (
    <div className="grid gap-4">
      <FormField
        id="embedUrl"
        label="Link to embed"
        error={value.url && !embed ? "This site can't be embedded." : undefined}
        hint={`Supported: ${EMBED_PROVIDERS.join(", ")}.`}
      >
        <Input id="embedUrl" value={value.url ?? ""} placeholder="https://…" onChange={(e) => onChange({ ...value, url: e.target.value })} />
      </FormField>
      <FormField id="embedHeight" label="Height (pixels)">
        <Input id="embedHeight" type="number" min={200} max={1600} value={value.height} className="w-28" onChange={(e) => onChange({ ...value, height: Number(e.target.value) || 600 })} />
      </FormField>
      {embed ? <iframe src={embed} title="Embed preview" style={{ height: value.height }} className="w-full rounded-md border" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" allowFullScreen /> : null}
    </div>
  );
}

