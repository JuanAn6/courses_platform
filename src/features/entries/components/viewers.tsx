"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/files";
import { toEmbedUrl, videoEmbedUrl } from "../embeds";
import { recordProgress, type ProgressResult } from "../progress-actions";
import type { FileInfo } from "../queries";
import type { AnyEntryContent, EntryContent, EntryType, Tracking } from "../registry";
import { PdfPages, PdfSlides } from "./pdf-lazy";

export type ViewerProps = {
  entryId: string;
  classId: string | null;
  type: EntryType;
  content: AnyEntryContent;
  files: FileInfo[];
  tracking: Tracking;
  threshold: number;
  /** "student" records progress; "preview" (staff) doesn't. */
  mode: "student" | "preview";
  initial: { status: ProgressResult["status"]; percent: number; position: number | null };
  /** Server-rendered body for TEXT entries. */
  textBody?: React.ReactNode;
};

type Report = { percent?: number; position?: number; deltaSec?: number; complete?: boolean };

function useProgress({ entryId, classId, mode, initial }: Pick<ViewerProps, "entryId" | "classId" | "mode" | "initial">) {
  const [state, setState] = useState<ProgressResult>({ status: initial.status, percent: initial.percent });
  const enabled = mode === "student" && !!classId;
  const send = useCallback(
    async (report: Report) => {
      if (!enabled || !classId) return;
      const res = await recordProgress({ classId, entryId, ...report });
      if (res.status === "success" && res.data) {
        setState((prev) => {
          if (prev.status !== "COMPLETED" && res.data!.status === "COMPLETED") toast.success("Completed!");
          return res.data!;
        });
      } else if (res.status === "error") toast.error(res.message);
    },
    [enabled, classId, entryId],
  );
  return { state, send, enabled };
}

export function EntryViewer(props: ViewerProps) {
  const { state, send, enabled } = useProgress(props);
  const done = state.status === "COMPLETED";
  const fileById = new Map(props.files.map((f) => [f.id, f]));

  // Record that the student opened the entry (starts time tracking).
  const opened = useRef(false);
  useEffect(() => {
    if (!enabled || opened.current) return;
    opened.current = true;
    if (props.initial.status === "NOT_STARTED") void send({});
  }, [enabled, props.initial.status, send]);

  return (
    <div className="grid min-w-0 gap-6">
      {props.mode === "preview" ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Preview: students see this. Progress isn&apos;t recorded.</p>
      ) : null}
      <Body {...props} fileById={fileById} send={send} />
      <CompletionBar tracking={props.tracking} threshold={props.threshold} done={done} percent={state.percent} enabled={enabled} send={send} />
    </div>
  );
}

function CompletionBar({
  tracking,
  threshold,
  done,
  percent,
  enabled,
  send,
}: {
  tracking: Tracking;
  threshold: number;
  done: boolean;
  percent: number;
  enabled: boolean;
  send: (r: Report) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const run = async (r: Report) => {
    setPending(true);
    await send(r);
    setPending(false);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      {done ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          <CheckCircle2 className="size-4" /> Completed
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          {tracking === "media"
            ? `Play at least ${threshold}% to complete (${percent}% so far).`
            : tracking === "pages"
              ? "Go through every slide to complete."
              : tracking === "link"
                ? "Open the link to complete."
                : "Mark this as done when you've finished."}
        </p>
      )}
      {tracking === "manual" && enabled ? (
        done ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run({ complete: false })}>
            Mark as not done
          </Button>
        ) : (
          <Button disabled={pending} onClick={() => run({ complete: true })}>
            <CheckCircle2 /> Mark as done
          </Button>
        )
      ) : null}
    </div>
  );
}

type BodyProps = ViewerProps & { fileById: Map<string, FileInfo>; send: (r: Report) => Promise<void> };

function Body(props: BodyProps) {
  const { type, content } = props;
  switch (type) {
    case "TEXT":
      return <article>{props.textBody}</article>;
    case "VIDEO": {
      const c = content as EntryContent<"VIDEO">;
      if (c.source === "url") {
        const embed = c.url ? videoEmbedUrl(c.url) : null;
        return embed ? <iframe src={embed} title="Video" className="aspect-video w-full rounded-lg border" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : <Unavailable />;
      }
      return c.fileId ? <MediaPlayer kind="video" src={`/api/files/${c.fileId}`} {...props} /> : <Unavailable />;
    }
    case "AUDIO": {
      const c = content as EntryContent<"AUDIO">;
      return c.fileId ? <MediaPlayer kind="audio" src={`/api/files/${c.fileId}`} {...props} /> : <Unavailable />;
    }
    case "DOCUMENT": {
      const c = content as EntryContent<"DOCUMENT">;
      return (
        <div className="grid gap-4">
          {c.fileIds.map((id, i) => {
            const f = props.fileById.get(id);
            return f ? <DocumentFile key={id} file={f} open={i === 0} /> : null;
          })}
        </div>
      );
    }
    case "PRESENTATION": {
      const c = content as EntryContent<"PRESENTATION">;
      if (c.source === "url") {
        const embed = c.url ? toEmbedUrl(c.url) : null;
        return embed ? <iframe src={embed} title="Slides" className="aspect-video w-full rounded-lg border" allowFullScreen /> : <Unavailable />;
      }
      const f = c.fileId ? props.fileById.get(c.fileId) : undefined;
      const pdfId = f ? (f.mime === "application/pdf" ? f.id : f.pdfFileId) : null;
      if (f?.status === "PROCESSING") return <p className="text-sm text-muted-foreground">The slides are still being prepared. Check back in a minute.</p>;
      return pdfId ? <Slides pdfId={pdfId} {...props} /> : <Unavailable />;
    }
    case "LINK": {
      const c = content as EntryContent<"LINK">;
      return c.url ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{c.url}</span>
          <Button asChild>
            <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={() => void props.send({ complete: true })}>
              <ExternalLink /> Open link
            </a>
          </Button>
        </div>
      ) : (
        <Unavailable />
      );
    }
    case "EMBED": {
      const c = content as EntryContent<"EMBED">;
      const embed = c.url ? toEmbedUrl(c.url) : null;
      return embed ? (
        <iframe
          src={embed}
          title="Embedded content"
          style={{ height: c.height }}
          className="w-full rounded-lg border"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          allowFullScreen
        />
      ) : (
        <Unavailable />
      );
    }
  }
}

function Unavailable() {
  return <p className="text-sm text-muted-foreground">This content isn&apos;t available.</p>;
}

function DocumentFile({ file, open }: { file: FileInfo; open: boolean }) {
  const isPdf = file.mime === "application/pdf";
  return (
    <details open={open && isPdf} className="group min-w-0 rounded-lg border">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{file.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{formatBytes(file.size)}</span>
        </span>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/files/${file.id}?download=1`} onClick={(e) => e.stopPropagation()}>
            <Download /> Download
          </a>
        </Button>
      </summary>
      {isPdf ? (
        <div className="border-t p-4">
          <PdfPages url={`/api/files/${file.id}`} />
        </div>
      ) : null}
    </details>
  );
}

function Slides({ pdfId, send, initial }: BodyProps & { pdfId: string }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onPage = useCallback(
    (page: number, total: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void send({ percent: (page / total) * 100, position: page }), 800);
    },
    [send],
  );
  return <PdfSlides url={`/api/files/${pdfId}`} initialPage={initial.position ?? 1} onPage={onPage} />;
}

function MediaPlayer({ kind, src, send, initial, threshold, mode }: BodyProps & { kind: "video" | "audio"; src: string }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const furthest = useRef(0);
  // `at` is set on the first playback event (Date.now() can't run during render).
  const lastReport = useRef({ at: 0, percent: 0 });
  const reachedThreshold = useRef(initial.percent >= threshold);

  const report = useCallback(
    (force = false) => {
      const el = ref.current;
      if (!el || !el.duration || mode !== "student") return;
      const percent = Math.min(100, (furthest.current / el.duration) * 100);
      const now = Date.now();
      if (!lastReport.current.at) lastReport.current.at = now;
      const crossed = !reachedThreshold.current && percent >= threshold;
      if (!force && !crossed && now - lastReport.current.at < 15_000) return;
      if (crossed) reachedThreshold.current = true;
      const deltaSec = (now - lastReport.current.at) / 1000;
      lastReport.current = { at: now, percent };
      void send({ percent, position: el.currentTime, deltaSec: el.paused ? 0 : deltaSec });
    },
    [send, threshold, mode],
  );

  const props = {
    ref,
    src,
    controls: true,
    preload: "metadata" as const,
    onLoadedMetadata: () => {
      const el = ref.current;
      if (el && initial.position && initial.position < el.duration - 5) el.currentTime = initial.position;
    },
    onTimeUpdate: () => {
      const el = ref.current;
      if (!el) return;
      furthest.current = Math.max(furthest.current, el.currentTime);
      report();
    },
    onPause: () => report(true),
    onEnded: () => {
      if (ref.current) furthest.current = ref.current.duration;
      report(true);
    },
  };
  return kind === "video" ? <video {...props} className="aspect-video w-full rounded-lg bg-black" /> : <audio {...props} className="w-full" />;
}
