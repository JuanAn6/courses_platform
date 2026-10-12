"use client";

import { useState } from "react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline,
  Undo,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpload } from "../components/use-upload";
import { richTextExtensions } from "./extensions";
import { safeHref } from "./sanitize";

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write the lesson…",
  label = "Content",
}: {
  value: unknown;
  onChange: (doc: unknown) => void;
  placeholder?: string;
  label?: string;
}) {
  const editor = useEditor({
    extensions: [...richTextExtensions, Placeholder.configure({ placeholder })],
    content: value as object,
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": label, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  return (
    <div className="rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} className="rich-text px-4 py-3" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("codeBlock"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const { upload, uploading, error } = useUpload("image");
  const [imageInput, setImageInput] = useState<HTMLInputElement | null>(null);

  const chain = () => editor.chain().focus();
  const buttons: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; run: () => void }[] = [
    { icon: Bold, label: "Bold", active: state.bold, run: () => chain().toggleBold().run() },
    { icon: Italic, label: "Italic", active: state.italic, run: () => chain().toggleItalic().run() },
    { icon: Underline, label: "Underline", active: state.underline, run: () => chain().toggleUnderline().run() },
    { icon: Strikethrough, label: "Strikethrough", active: state.strike, run: () => chain().toggleStrike().run() },
    { icon: Heading2, label: "Heading", active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: "Subheading", active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    { icon: List, label: "Bulleted list", active: state.bullet, run: () => chain().toggleBulletList().run() },
    { icon: ListOrdered, label: "Numbered list", active: state.ordered, run: () => chain().toggleOrderedList().run() },
    { icon: Quote, label: "Quote", active: state.quote, run: () => chain().toggleBlockquote().run() },
    { icon: Code, label: "Code block", active: state.code, run: () => chain().toggleCodeBlock().run() },
    { icon: Minus, label: "Divider", run: () => chain().setHorizontalRule().run() },
    {
      icon: LinkIcon,
      label: state.link ? "Remove link" : "Add link",
      active: state.link,
      run: () => {
        if (state.link) return chain().unsetLink().run();
        const href = window.prompt("Link address (https://…)");
        if (!href) return;
        const safe = safeHref(/^[a-z]+:|^\//i.test(href) ? href : `https://${href}`);
        if (safe) chain().extendMarkRange("link").setLink({ href: safe }).run();
        else window.alert("That link isn't allowed. Use an https:// address.");
      },
    },
    { icon: ImagePlus, label: uploading ? "Uploading image…" : "Insert image", disabled: uploading, run: () => imageInput?.click() },
    { icon: Undo, label: "Undo", disabled: !state.canUndo, run: () => chain().undo().run() },
    { icon: Redo, label: "Redo", disabled: !state.canRedo, run: () => chain().redo().run() },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1" role="toolbar" aria-label="Formatting">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          title={b.label}
          aria-label={b.label}
          aria-pressed={b.active ?? undefined}
          disabled={b.disabled}
          onClick={b.run}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
            b.active && "bg-accent text-foreground",
          )}
        >
          <b.icon className="size-4" />
        </button>
      ))}
      <input
        ref={setImageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Image file"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const uploaded = await upload(file);
          if (uploaded) chain().setImage({ src: `/api/files/${uploaded.id}`, alt: uploaded.name }).run();
        }}
      />
      {error ? <span className="px-2 text-xs text-destructive" role="alert">{error}</span> : null}
    </div>
  );
}
