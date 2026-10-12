/**
 * Entry type registry (pure). Each type defines its content shape, what it needs before it can be
 * published, which uploaded files it references, and how progress is tracked.
 * Editors and viewers are mapped in components/editors.tsx and components/viewers.tsx.
 * Adding a type: add it to the Prisma enum, here, and to both component maps.
 */
import { z } from "zod";
import { toEmbedUrl, isHttpUrl, videoEmbedUrl } from "./embeds";
import { EMPTY_DOC, sanitizeDoc } from "./rich-text/sanitize";

export const ENTRY_TYPES = ["TEXT", "VIDEO", "AUDIO", "DOCUMENT", "PRESENTATION", "LINK", "EMBED"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** manual: student marks it done · media: watched/listened percentage · pages: last slide reached · link: opened. */
export type Tracking = "manual" | "media" | "pages" | "link";

const optionalId = z.string().min(1).nullish().transform((v) => v ?? null);
const optionalUrl = z.string().trim().max(2000).nullish().transform((v) => v || null);
const completion = z.coerce.number().int().min(10).max(100).default(90);

export const contentSchemas = {
  TEXT: z.object({ doc: z.unknown().default(EMPTY_DOC) }),
  VIDEO: z.object({
    source: z.enum(["file", "url"]).default("file"),
    fileId: optionalId,
    url: optionalUrl,
    completionPercent: completion,
  }),
  AUDIO: z.object({ fileId: optionalId, completionPercent: completion }),
  DOCUMENT: z.object({ fileIds: z.array(z.string().min(1)).max(20).default([]) }),
  PRESENTATION: z.object({ source: z.enum(["file", "url"]).default("file"), fileId: optionalId, url: optionalUrl }),
  LINK: z.object({ url: optionalUrl }),
  EMBED: z.object({ url: optionalUrl, height: z.coerce.number().int().min(200).max(1600).default(600) }),
} satisfies Record<EntryType, z.ZodType>;

export type EntryContent<T extends EntryType> = z.output<(typeof contentSchemas)[T]>;
export type AnyEntryContent = { [T in EntryType]: EntryContent<T> }[EntryType];

export type UploadKind = "video" | "audio" | "document" | "presentation" | "image";

export const ENTRY_TYPE_INFO: Record<
  EntryType,
  { label: string; description: string; icon: string; upload?: UploadKind }
> = {
  TEXT: { label: "Text", description: "Formatted text with headings, lists, links and images.", icon: "file-text" },
  VIDEO: { label: "Video", description: "An uploaded video or a YouTube/Vimeo link.", icon: "video", upload: "video" },
  AUDIO: { label: "Audio", description: "An audio file or podcast episode.", icon: "audio", upload: "audio" },
  DOCUMENT: { label: "Documents", description: "PDFs and other files to read or download.", icon: "files", upload: "document" },
  PRESENTATION: { label: "Presentation", description: "Slides from a PDF/PowerPoint file or Google Slides.", icon: "presentation", upload: "presentation" },
  LINK: { label: "Link", description: "A link to an external website.", icon: "link" },
  EMBED: { label: "Embed", description: "Interactive content from Google, H5P, Genially, Figma or Canva.", icon: "embed" },
};

/** Allowed MIME types and size limits per upload kind. */
export const UPLOAD_RULES: Record<UploadKind, { mimes: Record<string, string>; maxBytes: number }> = {
  video: { mimes: { "video/mp4": "MP4", "video/webm": "WebM" }, maxBytes: 1024 * 1024 * 1024 },
  audio: {
    mimes: { "audio/mpeg": "MP3", "audio/mp4": "M4A", "audio/x-m4a": "M4A", "audio/ogg": "OGG", "audio/wav": "WAV", "audio/webm": "WebM" },
    maxBytes: 200 * 1024 * 1024,
  },
  document: {
    mimes: {
      "application/pdf": "PDF",
      "application/msword": "Word",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
      "application/vnd.ms-excel": "Excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
      "application/vnd.ms-powerpoint": "PowerPoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
      "text/plain": "Text",
      "text/csv": "CSV",
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "application/zip": "ZIP",
    },
    maxBytes: 50 * 1024 * 1024,
  },
  presentation: {
    mimes: {
      "application/pdf": "PDF",
      "application/vnd.ms-powerpoint": "PowerPoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
      "application/vnd.oasis.opendocument.presentation": "OpenDocument",
    },
    maxBytes: 100 * 1024 * 1024,
  },
  image: {
    mimes: { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP", "image/gif": "GIF" },
    maxBytes: 10 * 1024 * 1024,
  },
};

export function parseContent<T extends EntryType>(type: T, raw: unknown): EntryContent<T> {
  const parsed = contentSchemas[type].safeParse(raw ?? {});
  return (parsed.success ? parsed.data : contentSchemas[type].parse({})) as EntryContent<T>;
}

/** Normalizes content for storage (rich text is whitelisted) and lists referenced files. */
export function prepareContent(type: EntryType, raw: unknown): { content: AnyEntryContent; fileIds: string[] } {
  if (type === "TEXT") {
    const { doc, fileIds } = sanitizeDoc((raw as { doc?: unknown } | null)?.doc);
    return { content: { doc }, fileIds };
  }
  const content = contentSchemas[type].parse(raw ?? {}) as AnyEntryContent;
  return { content, fileIds: referencedFiles(type, content) };
}

export function referencedFiles(type: EntryType, content: AnyEntryContent): string[] {
  const c = content as Record<string, unknown>;
  if (type === "DOCUMENT") return [...new Set((c.fileIds as string[]) ?? [])];
  if (type === "TEXT") return sanitizeDoc(c.doc).fileIds;
  if ((type === "VIDEO" || type === "PRESENTATION") && c.source === "url") return [];
  return typeof c.fileId === "string" ? [c.fileId] : [];
}

/** What's missing before the entry can be published (empty = ready). */
export function publishProblems(type: EntryType, raw: unknown): string[] {
  const c = parseContent(type, raw) as Record<string, unknown>;
  switch (type) {
    case "TEXT": {
      const { textLength, fileIds } = sanitizeDoc(c.doc);
      return textLength > 0 || fileIds.length > 0 ? [] : ["Write some text."];
    }
    case "VIDEO":
      if (c.source === "url") return videoEmbedUrl(String(c.url ?? "")) ? [] : ["Enter a YouTube or Vimeo link."];
      return c.fileId ? [] : ["Upload a video."];
    case "AUDIO":
      return c.fileId ? [] : ["Upload an audio file."];
    case "DOCUMENT":
      return (c.fileIds as string[]).length ? [] : ["Upload at least one file."];
    case "PRESENTATION":
      if (c.source === "url") return toEmbedUrl(String(c.url ?? "")) ? [] : ["Enter a Google Slides link."];
      return c.fileId ? [] : ["Upload a PDF or PowerPoint file."];
    case "LINK":
      return isHttpUrl(String(c.url ?? "")) ? [] : ["Enter a web address starting with https://"];
    case "EMBED":
      return toEmbedUrl(String(c.url ?? "")) ? [] : ["Enter a link from a supported provider."];
  }
}

export function trackingFor(type: EntryType, raw: unknown): Tracking {
  const c = parseContent(type, raw) as Record<string, unknown>;
  if (type === "VIDEO") return c.source === "file" ? "media" : "manual";
  if (type === "AUDIO") return "media";
  if (type === "PRESENTATION") return c.source === "file" ? "pages" : "manual";
  if (type === "LINK") return "link";
  return "manual";
}

/** Percentage required to count a media entry as completed. */
export function completionThreshold(type: EntryType, raw: unknown): number {
  const c = parseContent(type, raw) as Record<string, unknown>;
  return typeof c.completionPercent === "number" ? c.completionPercent : 100;
}
