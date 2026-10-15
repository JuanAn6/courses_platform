"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Dices, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { QUESTION_TYPE_INFO, type QuestionType } from "../questions";
import type { QuizItem, QuizSettings } from "../quiz";

export type BankEntry = { id: string; type: QuestionType; text: string; points: number; tags: string[] };
type QuizContent = { settings: QuizSettings; items: QuizItem[] };

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
      <span>
        {label}
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function QuizEditor({
  value,
  onChange,
  bank,
  courseId,
}: {
  value: QuizContent;
  onChange: (next: QuizContent) => void;
  bank: BankEntry[];
  courseId: string;
}) {
  const { settings, items } = value;
  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of bank) for (const t of q.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort();
  }, [bank]);
  const set = (patch: Partial<QuizSettings>) => onChange({ ...value, settings: { ...settings, ...patch } });
  const setItems = (next: QuizItem[]) => onChange({ ...value, items: next });

  const total = items.reduce((sum, it) => {
    if (it.kind === "question") return sum + (it.points ?? byId.get(it.questionId)?.points ?? 0);
    const avg = bank.filter((q) => q.tags.includes(it.tag)).reduce((s, q, _, arr) => s + q.points / arr.length, 0);
    return sum + (it.points ?? avg) * it.count;
  }, 0);
  const count = items.reduce((n, it) => n + (it.kind === "question" ? 1 : it.count), 0);
  const numberOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v)));

  return (
    <div className="grid gap-6">
      <section className="grid gap-3" aria-labelledby="quiz-questions">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="quiz-questions" className="text-sm font-semibold">
            Questions <span className="font-normal text-muted-foreground">· {count} question{count === 1 ? "" : "s"} · {Math.round(total * 100) / 100} points</span>
          </h3>
          <Link href={`/teach/courses/${courseId}/questions`} className="text-sm underline underline-offset-4" target="_blank">
            Open question bank
          </Link>
        </div>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No questions yet.</p> : null}
        <ol className="grid gap-2">
          {items.map((it, i) => {
            const q = it.kind === "question" ? byId.get(it.questionId) : undefined;
            const label = it.kind === "question" ? (q ? q.text || "(no text)" : "Deleted question (skipped)") : `${it.count} random question${it.count === 1 ? "" : "s"} tagged “${it.tag}”`;
            return (
              <li key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                {it.kind === "random" ? <Dices className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>}
                <span className="min-w-0 flex-1">
                  <span className={q || it.kind === "random" ? "line-clamp-2" : "text-destructive"}>{label}</span>
                  {q ? <span className="block text-xs text-muted-foreground">{QUESTION_TYPE_INFO[q.type].label}</span> : null}
                </span>
                <label className="sr-only" htmlFor={`pts-${i}`}>Points for item {i + 1}</label>
                <Input
                  id={`pts-${i}`}
                  type="number"
                  min={0}
                  step="0.5"
                  className="h-7 w-20"
                  placeholder={String(q?.points ?? "pts")}
                  value={it.points ?? ""}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, points: numberOrNull(e.target.value) } : x)))}
                />
                <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => setItems(items.map((x, j) => (j === i - 1 ? items[i] : j === i ? items[i - 1] : x)))} aria-label={`Move item ${i + 1} up`}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === items.length - 1} onClick={() => setItems(items.map((x, j) => (j === i + 1 ? items[i] : j === i ? items[i + 1] : x)))} aria-label={`Move item ${i + 1} down`}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`}><Trash2 /></Button>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <AddQuestions bank={bank} exclude={new Set(items.flatMap((i) => (i.kind === "question" ? [i.questionId] : [])))} onAdd={(ids) => setItems([...items, ...ids.map((questionId) => ({ kind: "question" as const, questionId, points: null }))])} />
          <AddRandom tags={tags} onAdd={(tag, n) => setItems([...items, { kind: "random", tag, count: n, points: null }])} />
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="quiz-settings">
        <h3 id="quiz-settings" className="text-sm font-semibold">Settings</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="timeLimit" label="Time limit (minutes)" hint="Empty for no limit.">
            <Input id="timeLimit" type="number" min={1} value={settings.timeLimitMin ?? ""} onChange={(e) => set({ timeLimitMin: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null })} />
          </FormField>
          <FormField id="maxAttempts" label="Attempts allowed" hint="0 for unlimited.">
            <Input id="maxAttempts" type="number" min={0} value={settings.maxAttempts} onChange={(e) => set({ maxAttempts: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          </FormField>
          <FormField id="scoring" label="Grade from">
            <NativeSelect id="scoring" value={settings.scoring} onChange={(e) => set({ scoring: e.target.value as QuizSettings["scoring"] })}>
              <option value="highest">Best attempt</option>
              <option value="last">Last attempt</option>
              <option value="average">Average of attempts</option>
            </NativeSelect>
          </FormField>
          <FormField id="showResults" label="Show results">
            <NativeSelect id="showResults" value={settings.showResults} onChange={(e) => set({ showResults: e.target.value as QuizSettings["showResults"] })}>
              <option value="after_submit">Right after submitting</option>
              <option value="after_due">After the due date</option>
              <option value="never">Never (score only in grades)</option>
            </NativeSelect>
          </FormField>
          <FormField id="passing" label="Passing score (%)" hint="Optional.">
            <Input id="passing" type="number" min={0} max={100} value={settings.passingPercent ?? ""} onChange={(e) => set({ passingPercent: e.target.value ? Math.min(100, Math.max(0, Math.round(Number(e.target.value)))) : null })} />
          </FormField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Show correct answers with the results" checked={settings.showCorrectAnswers} onChange={(v) => set({ showCorrectAnswers: v })} />
          <Toggle label="Shuffle question order" checked={settings.shuffleQuestions} onChange={(v) => set({ shuffleQuestions: v })} />
          <Toggle label="Shuffle answer options" checked={settings.shuffleOptions} onChange={(v) => set({ shuffleOptions: v })} />
          <Toggle label="One question per page" checked={settings.onePerPage} onChange={(v) => set({ onePerPage: v })} />
          <Toggle label="Close at the due date" hint="No new attempts after it; open attempts are submitted then." checked={settings.lockAfterDue} onChange={(v) => set({ lockAfterDue: v })} />
        </div>
      </section>
    </div>
  );
}

function AddQuestions({ bank, exclude, onAdd }: { bank: BankEntry[]; exclude: Set<string>; onAdd: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const available = bank.filter((q) => !exclude.has(q.id) && (!search || q.text.toLowerCase().includes(search.toLowerCase()) || q.tags.some((t) => t.includes(search.toLowerCase()))));
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPicked([]); setSearch(""); } }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm"><Plus /> Add from bank</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add questions</DialogTitle>
          <DialogDescription>Pick questions from this course&apos;s bank.</DialogDescription>
        </DialogHeader>
        <label htmlFor="bank-search" className="sr-only">Search questions</label>
        <Input id="bank-search" placeholder="Search text or tag" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {available.length === 0 ? <li className="p-3 text-sm text-muted-foreground">No questions to add.</li> : null}
          {available.map((q) => (
            <li key={q.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={picked.includes(q.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, q.id] : picked.filter((p) => p !== q.id))}
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{q.text || "(no text)"}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {QUESTION_TYPE_INFO[q.type].label} · {q.points} pt{q.points === 1 ? "" : "s"}
                    {q.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" disabled={!picked.length} onClick={() => { onAdd(picked); setOpen(false); setPicked([]); }}>
            Add {picked.length || ""} question{picked.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRandom({ tags, onAdd }: { tags: [string, number][]; onAdd: (tag: string, count: number) => void }) {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [count, setCount] = useState(1);
  const max = tags.find(([t]) => t === tag)?.[1] ?? 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!tags.length}><Dices /> Add random questions</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Random questions</DialogTitle>
          <DialogDescription>Each student gets a different selection of questions with this tag.</DialogDescription>
        </DialogHeader>
        <FormField id="random-tag" label="Tag">
          <NativeSelect id="random-tag" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Choose a tag…</option>
            {tags.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="random-count" label="How many" hint={tag ? `Up to ${max}.` : undefined}>
          <Input id="random-count" type="number" min={1} max={Math.max(1, max)} value={count} onChange={(e) => setCount(Math.max(1, Math.round(Number(e.target.value) || 1)))} className="w-24" />
        </FormField>
        <DialogFooter>
          <Button type="button" disabled={!tag || count > max} onClick={() => { onAdd(tag, count); setOpen(false); }}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
