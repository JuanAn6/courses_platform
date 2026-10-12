/** Pure helpers for uploads (validation, naming). */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** MIME types accepted for office documents. */
export const DOCUMENT_MIME_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/webp": "WebP image",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.ms-excel": "Excel spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel spreadsheet",
  "text/plain": "Text file",
};

export function isAllowedDocumentType(mime: string): boolean {
  return Object.hasOwn(DOCUMENT_MIME_TYPES, mime);
}

/** Keeps a readable, filesystem- and header-safe file name. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.\-]+/, "")
    .slice(0, 120);
  return cleaned || "file";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
