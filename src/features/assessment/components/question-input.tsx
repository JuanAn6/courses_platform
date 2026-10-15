"use client";

import { ArrowDown, ArrowUp, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { FilePicker } from "@/features/entries/components/file-picker";
import { cn } from "@/lib/utils";
import type { StudentQuestionView } from "../questions";

type Props = {
  /** Unique per question on the page (for input ids/names). */
  name: string;
  view: StudentQuestionView;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  /** File names for FILE_UPLOAD answers. */
  fileNames?: Record<string, string>;
  onFileName?: (id: string, name: string) => void;
};

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** The answering control for one question (student view: no answers inside). */
export function QuestionInput({ name, view, value, onChange, disabled, fileNames = {}, onFileName }: Props) {
  switch (view.type) {
    case "SINGLE_CHOICE":
      return (
        <div role="radiogroup" aria-label="Choose one" className="grid gap-2">
          {view.options.map((o) => (
            <label key={o.id} className={cn("flex items-start gap-3 rounded-md border px-3 py-2 text-sm", value.choice === o.id && "border-primary bg-accent/50")}>
              <input type="radio" name={name} disabled={disabled} checked={value.choice === o.id} onChange={() => onChange({ choice: o.id })} className="mt-0.5 accent-primary" />
              {o.text}
            </label>
          ))}
        </div>
      );
    case "MULTIPLE_CHOICE": {
      const chosen = new Set((value.choices as string[]) ?? []);
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs text-muted-foreground">Choose all that apply</legend>
          {view.options.map((o) => (
            <label key={o.id} className={cn("flex items-start gap-3 rounded-md border px-3 py-2 text-sm", chosen.has(o.id) && "border-primary bg-accent/50")}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={chosen.has(o.id)}
                onChange={(e) => {
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(o.id);
                  else next.delete(o.id);
                  onChange({ choices: [...next] });
                }}
                className="mt-0.5 size-4 accent-primary"
              />
              {o.text}
            </label>
          ))}
        </fieldset>
      );
    }
    case "TRUE_FALSE":
      return (
        <div role="radiogroup" aria-label="True or false" className="flex gap-3">
          {[true, false].map((v) => (
            <label key={String(v)} className={cn("flex items-center gap-2 rounded-md border px-4 py-2 text-sm", value.value === v && "border-primary bg-accent/50")}>
              <input type="radio" name={name} disabled={disabled} checked={value.value === v} onChange={() => onChange({ value: v })} className="accent-primary" />
              {v ? "True" : "False"}
            </label>
          ))}
        </div>
      );
    case "SHORT_ANSWER":
      return (
        <Input aria-label="Your answer" disabled={disabled} value={(value.text as string) ?? ""} maxLength={500} onChange={(e) => onChange({ text: e.target.value })} />
      );
    case "NUMERIC":
      return (
        <Input aria-label="Your answer" inputMode="decimal" className="max-w-48" disabled={disabled} value={(value.value as string) ?? ""} maxLength={50} onChange={(e) => onChange({ value: e.target.value })} />
      );
    case "MATCHING": {
      const matches = (value.matches as Record<string, string>) ?? {};
      return (
        <div className="grid gap-2">
          {view.left.map((l) => (
            <div key={l.id} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr]">
              <label htmlFor={`${name}-${l.id}`} className="text-sm">{l.text}</label>
              <NativeSelect
                id={`${name}-${l.id}`}
                disabled={disabled}
                value={matches[l.id] ?? ""}
                onChange={(e) => onChange({ matches: { ...matches, [l.id]: e.target.value } })}
              >
                <option value="">Choose…</option>
                {view.right.map((r) => (
                  <option key={r.id} value={r.id}>{r.text}</option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
      );
    }
    case "ORDERING": {
      const ids = (value.order as string[])?.length === view.items.length ? (value.order as string[]) : view.items.map((i) => i.id);
      const byId = new Map(view.items.map((i) => [i.id, i]));
      const move = (index: number, delta: number) => {
        const next = [...ids];
        [next[index], next[index + delta]] = [next[index + delta], next[index]];
        onChange({ order: next });
      };
      return (
        <ol className="grid gap-2" aria-label="Put these in order">
          {ids.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="w-5 text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="flex-1">{byId.get(id)?.text}</span>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move “${byId.get(id)?.text}” up`}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={disabled || i === ids.length - 1} onClick={() => move(i, 1)} aria-label={`Move “${byId.get(id)?.text}” down`}>
                <ArrowDown />
              </Button>
            </li>
          ))}
        </ol>
      );
    }
    case "FILL_BLANKS": {
      const blanks = (value.blanks as string[]) ?? [];
      return (
        <p className="leading-loose">
          {view.parts.map((part, i) =>
            typeof part === "string" ? (
              <span key={i} className="whitespace-pre-wrap">{part}</span>
            ) : (
              <Input
                key={i}
                aria-label={`Blank ${part.blank + 1}`}
                disabled={disabled}
                className="mx-1 inline-flex h-7 w-36 align-baseline"
                value={blanks[part.blank] ?? ""}
                maxLength={200}
                onChange={(e) => {
                  const next = Array.from({ length: view.blankCount }, (_, j) => blanks[j] ?? "");
                  next[part.blank] = e.target.value;
                  onChange({ blanks: next });
                }}
              />
            ),
          )}
        </p>
      );
    }
    case "ESSAY": {
      const text = (value.text as string) ?? "";
      const words = wordCount(text);
      return (
        <div className="grid gap-1">
          <Textarea aria-label="Your answer" rows={8} disabled={disabled} value={text} onChange={(e) => onChange({ text: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            {words} word{words === 1 ? "" : "s"}
            {view.minWords ? ` · at least ${view.minWords}` : ""}
            {view.maxWords ? ` · at most ${view.maxWords}` : ""}
          </p>
        </div>
      );
    }
    case "FILE_UPLOAD": {
      const fileIds = (value.fileIds as string[]) ?? [];
      return (
        <div className="grid gap-2">
          {fileIds.map((id) => (
            <div key={id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0" aria-hidden /> <span className="truncate">{fileNames[id] ?? "Uploaded file"}</span></span>
              {!disabled ? (
                <Button type="button" variant="ghost" size="icon" aria-label="Remove file" onClick={() => onChange({ fileIds: fileIds.filter((f) => f !== id) })}>
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
          {!disabled && fileIds.length < view.maxFiles ? (
            <FilePicker
              kind="submission"
              label="Upload file"
              onUploaded={(f) => {
                onFileName?.(f.id, f.name);
                onChange({ fileIds: [...fileIds, f.id] });
              }}
            />
          ) : null}
        </div>
      );
    }
  }
}
