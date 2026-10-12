import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { cn } from "@/lib/utils";
import { richTextExtensions } from "./extensions";
import { sanitizeDoc } from "./sanitize";

/** Renders stored rich text as React elements (no raw HTML). Re-sanitizes defensively. */
export function RichTextView({ doc, className }: { doc: unknown; className?: string }) {
  const { doc: safe } = sanitizeDoc(doc);
  return <div className={cn("rich-text", className)}>{renderToReactElement({ content: safe, extensions: richTextExtensions })}</div>;
}
