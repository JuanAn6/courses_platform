"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { parseBlanks, type QuestionType } from "../questions";

type Data = Record<string, unknown>;
type Props = { value: Data; onChange: (next: Data) => void };

export const newId = () => crypto.randomUUID().slice(0, 8);

/** Starting data for a new question of a type. */
export function defaultQuestionData(type: QuestionType): Data {
  const two = () => [
    { id: newId(), text: "" },
    { id: newId(), text: "" },
  ];
  switch (type) {
    case "SINGLE_CHOICE": {
      const options = two();
      return { options, correct: options[0].id };
    }
    case "MULTIPLE_CHOICE": {
      const options = two();
      return { options, correct: [options[0].id], partialCredit: true };
    }
    case "TRUE_FALSE":
      return { correct: true };
    case "SHORT_ANSWER":
      return { accepted: [""], caseSensitive: false, patterns: [] };
    case "NUMERIC":
      return { answer: 0, tolerance: 0 };
    case "MATCHING":
      return { pairs: [{ id: newId(), left: "", right: "" }, { id: newId(), left: "", right: "" }], partialCredit: true };
    case "ORDERING":
      return { items: two(), partialCredit: true };
    case "FILL_BLANKS":
      return { text: "", caseSensitive: false };
    case "ESSAY":
      return { minWords: null, maxWords: null };
    case "FILE_UPLOAD":
      return { maxFiles: 1 };
  }
}

function move<T>(list: T[], i: number, d: number) {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

/** Edits the answer side of a question. */
export function QuestionDataEditor({ type, value, onChange }: { type: QuestionType } & Props) {
  switch (type) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return <ChoiceEditor multiple={type === "MULTIPLE_CHOICE"} value={value} onChange={onChange} />;
    case "TRUE_FALSE":
      return (
        <div role="radiogroup" aria-label="Correct answer" className="flex gap-4 text-sm">
          {[true, false].map((v) => (
            <label key={String(v)} className="flex items-center gap-2">
              <input type="radio" checked={value.correct === v} onChange={() => onChange({ correct: v })} className="accent-primary" />
              {v ? "True" : "False"} is correct
            </label>
          ))}
        </div>
      );
    case "SHORT_ANSWER":
      return (
        <div className="grid gap-4">
          <FormField id="accepted" label="Accepted answers" hint="One per line. Extra spaces are ignored.">
            <Textarea id="accepted" rows={3} value={(value.accepted as string[]).join("\n")} onChange={(e) => onChange({ ...value, accepted: e.target.value.split("\n") })} />
          </FormField>
          <Check label="Case-sensitive" checked={!!value.caseSensitive} onChange={(caseSensitive) => onChange({ ...value, caseSensitive })} />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Advanced: patterns</summary>
            <FormField id="patterns" label="Regular expressions" hint="One per line, matched against the whole answer, e.g. colou?r">
              <Textarea id="patterns" rows={2} className="font-mono" value={(value.patterns as string[]).join("\n")} onChange={(e) => onChange({ ...value, patterns: lines(e.target.value) })} />
            </FormField>
          </details>
        </div>
      );
    case "NUMERIC":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="answer" label="Correct answer">
            <Input id="answer" type="number" step="any" value={String(value.answer ?? "")} onChange={(e) => onChange({ ...value, answer: Number(e.target.value) })} />
          </FormField>
          <FormField id="tolerance" label="Accepted margin (±)" hint="0 for an exact answer.">
            <Input id="tolerance" type="number" step="any" min={0} value={String(value.tolerance ?? 0)} onChange={(e) => onChange({ ...value, tolerance: Math.abs(Number(e.target.value)) })} />
          </FormField>
        </div>
      );
    case "MATCHING": {
      const pairs = value.pairs as { id: string; left: string; right: string }[];
      return (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">Each item on the left matches the item on its right. Students see the right side shuffled.</p>
          {pairs.map((pair, i) => (
            <div key={pair.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input aria-label={`Item ${i + 1}`} value={pair.left} placeholder="Item" onChange={(e) => onChange({ ...value, pairs: pairs.map((p) => (p.id === pair.id ? { ...p, left: e.target.value } : p)) })} />
              <Input aria-label={`Match ${i + 1}`} value={pair.right} placeholder="Matches" onChange={(e) => onChange({ ...value, pairs: pairs.map((p) => (p.id === pair.id ? { ...p, right: e.target.value } : p)) })} />
              <Button type="button" variant="ghost" size="icon" disabled={pairs.length <= 2} onClick={() => onChange({ ...value, pairs: pairs.filter((p) => p.id !== pair.id) })} aria-label={`Remove pair ${i + 1}`}><Trash2 /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" variant="outline" size="sm" disabled={pairs.length >= 12} onClick={() => onChange({ ...value, pairs: [...pairs, { id: newId(), left: "", right: "" }] })}><Plus /> Add pair</Button>
            <Check label="Partial credit per pair" checked={!!value.partialCredit} onChange={(partialCredit) => onChange({ ...value, partialCredit })} />
          </div>
        </div>
      );
    }
    case "ORDERING": {
      const items = value.items as { id: string; text: string }[];
      return (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">Enter the items in the correct order. Students see them shuffled.</p>
          {items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-5 text-sm tabular-nums text-muted-foreground">{i + 1}.</span>
              <Input aria-label={`Position ${i + 1}`} value={item.text} onChange={(e) => onChange({ ...value, items: items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)) })} />
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => onChange({ ...value, items: move(items, i, -1) })} aria-label={`Move item ${i + 1} up`}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === items.length - 1} onClick={() => onChange({ ...value, items: move(items, i, 1) })} aria-label={`Move item ${i + 1} down`}><ArrowDown /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={items.length <= 2} onClick={() => onChange({ ...value, items: items.filter((x) => x.id !== item.id) })} aria-label={`Remove item ${i + 1}`}><Trash2 /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" variant="outline" size="sm" disabled={items.length >= 12} onClick={() => onChange({ ...value, items: [...items, { id: newId(), text: "" }] })}><Plus /> Add item</Button>
            <Check label="Partial credit for items in the right place" checked={!!value.partialCredit} onChange={(partialCredit) => onChange({ ...value, partialCredit })} />
          </div>
        </div>
      );
    }
    case "FILL_BLANKS": {
      const blanks = parseBlanks(String(value.text ?? "")).answers.length;
      return (
        <div className="grid gap-3">
          <FormField id="blanksText" label="Text with blanks" hint="Wrap each answer in double brackets: The sky is [[blue]]. Alternatives: [[color|colour]].">
            <Textarea id="blanksText" rows={4} value={String(value.text ?? "")} onChange={(e) => onChange({ ...value, text: e.target.value })} />
          </FormField>
          <p className="text-xs text-muted-foreground">{blanks} blank{blanks === 1 ? "" : "s"}</p>
          <Check label="Case-sensitive" checked={!!value.caseSensitive} onChange={(caseSensitive) => onChange({ ...value, caseSensitive })} />
        </div>
      );
    }
    case "ESSAY":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="minWords" label="Minimum words" hint="Optional (shown as guidance).">
            <Input id="minWords" type="number" min={0} value={value.minWords == null ? "" : String(value.minWords)} onChange={(e) => onChange({ ...value, minWords: e.target.value ? Number(e.target.value) : null })} />
          </FormField>
          <FormField id="maxWords" label="Maximum words" hint="Optional.">
            <Input id="maxWords" type="number" min={1} value={value.maxWords == null ? "" : String(value.maxWords)} onChange={(e) => onChange({ ...value, maxWords: e.target.value ? Number(e.target.value) : null })} />
          </FormField>
          <p className="text-sm text-muted-foreground sm:col-span-2">Essays are graded by a teacher.</p>
        </div>
      );
    case "FILE_UPLOAD":
      return (
        <div className="grid gap-2">
          <FormField id="maxFiles" label="Files allowed">
            <Input id="maxFiles" type="number" min={1} max={5} className="w-24" value={String(value.maxFiles ?? 1)} onChange={(e) => onChange({ maxFiles: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
          </FormField>
          <p className="text-sm text-muted-foreground">Uploads are graded by a teacher.</p>
        </div>
      );
  }
}

function ChoiceEditor({ multiple, value, onChange }: { multiple: boolean } & Props) {
  const options = value.options as { id: string; text: string }[];
  const correct = multiple ? new Set(value.correct as string[]) : new Set([value.correct as string]);
  const setCorrect = (id: string, on: boolean) => {
    if (!multiple) return onChange({ ...value, correct: id });
    const next = new Set(correct);
    if (on) next.add(id);
    else next.delete(id);
    onChange({ ...value, correct: options.map((o) => o.id).filter((o) => next.has(o)) });
  };
  const remove = (id: string) => {
    const rest = options.filter((o) => o.id !== id);
    onChange({
      ...value,
      options: rest,
      correct: multiple ? (value.correct as string[]).filter((c) => c !== id) : correct.has(id) ? rest[0].id : value.correct,
    });
  };
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">{multiple ? "Tick every correct option." : "Select the correct option."}</p>
      {options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <input
            type={multiple ? "checkbox" : "radio"}
            name="correct-option"
            aria-label={`Option ${i + 1} is correct`}
            checked={correct.has(o.id)}
            onChange={(e) => setCorrect(o.id, e.target.checked)}
            className="size-4 accent-primary"
          />
          <Input aria-label={`Option ${i + 1}`} value={o.text} onChange={(e) => onChange({ ...value, options: options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} />
          <Button type="button" variant="ghost" size="icon" disabled={options.length <= 2} onClick={() => remove(o.id)} aria-label={`Remove option ${i + 1}`}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" size="sm" disabled={options.length >= 12} onClick={() => onChange({ ...value, options: [...options, { id: newId(), text: "" }] })}><Plus /> Add option</Button>
        {multiple ? <Check label="Partial credit" checked={!!value.partialCredit} onChange={(partialCredit) => onChange({ ...value, partialCredit })} /> : null}
      </div>
    </div>
  );
}
