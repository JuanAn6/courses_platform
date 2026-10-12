/**
 * Server-side whitelist for Tiptap JSON. Anything not listed is dropped, so stored documents can
 * only contain these nodes, marks and attributes. Also collects the uploaded files it references.
 */

export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export const EMPTY_DOC: RichNode = { type: "doc", content: [{ type: "paragraph" }] };

const BLOCKS = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
  "text",
]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);
const FILE_SRC = /^\/api\/files\/([a-z0-9]{20,40})$/;
const MAX_NODES = 20_000;

export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h)) {
    try {
      new URL(h);
      return h;
    } catch {
      return null;
    }
  }
  if (h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/\\")) return h;
  return null;
}

function safeImageSrc(src: unknown, fileIds: Set<string>): string | null {
  if (typeof src !== "string") return null;
  const m = src.match(FILE_SRC);
  if (m) {
    fileIds.add(m[1]);
    return src;
  }
  return /^https:\/\//i.test(src) && safeHref(src) ? src : null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export function sanitizeDoc(input: unknown): { doc: RichNode; fileIds: string[]; textLength: number } {
  const fileIds = new Set<string>();
  let count = 0;
  let textLength = 0;

  const visit = (node: unknown, depth: number): RichNode | null => {
    if (!node || typeof node !== "object" || depth > 40 || ++count > MAX_NODES) return null;
    const n = node as RichNode;
    if (!BLOCKS.has(n.type)) return null;

    if (n.type === "text") {
      if (typeof n.text !== "string" || n.text.length === 0) return null;
      textLength += n.text.length;
      const marks = (n.marks ?? []).flatMap((m) => {
        if (!m || !MARKS.has(m.type)) return [];
        if (m.type !== "link") return [{ type: m.type }];
        const href = safeHref(m.attrs?.href);
        return href ? [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } }] : [];
      });
      return { type: "text", text: n.text.slice(0, 100_000), ...(marks.length ? { marks } : {}) };
    }

    const out: RichNode = { type: n.type };
    if (n.type === "heading") {
      const level = Number(n.attrs?.level);
      out.attrs = { level: [2, 3, 4].includes(level) ? level : 2 };
    } else if (n.type === "orderedList") {
      const start = Number(n.attrs?.start);
      out.attrs = { start: Number.isInteger(start) && start > 0 ? start : 1 };
    } else if (n.type === "codeBlock") {
      const language = str(n.attrs?.language, 30);
      out.attrs = { language: language && /^[\w+-]+$/.test(language) ? language : null };
    } else if (n.type === "image") {
      const src = safeImageSrc(n.attrs?.src, fileIds);
      if (!src) return null;
      out.attrs = { src, alt: str(n.attrs?.alt, 300) ?? "", title: str(n.attrs?.title, 300) ?? null };
      return out;
    }

    if (Array.isArray(n.content)) {
      const children = n.content.map((c) => visit(c, depth + 1)).filter((c): c is RichNode => c !== null);
      if (children.length) out.content = children;
    }
    return out;
  };

  const doc = visit(input, 0);
  if (!doc || doc.type !== "doc") return { doc: EMPTY_DOC, fileIds: [], textLength: 0 };
  if (!doc.content?.length) doc.content = [{ type: "paragraph" }];
  return { doc, fileIds: [...fileIds], textLength };
}
