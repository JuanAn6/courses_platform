"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newId } from "./question-data-editor";
import { rubricMax, type Rubric } from "../rubric";

export const defaultRubric = (): Rubric => ({
  criteria: [
    {
      id: newId(),
      title: "Content",
      description: "",
      levels: [
        { id: newId(), label: "Needs work", points: 1, description: "" },
        { id: newId(), label: "Good", points: 3, description: "" },
        { id: newId(), label: "Excellent", points: 5, description: "" },
      ],
    },
  ],
});

export function RubricEditor({ value, onChange }: { value: Rubric; onChange: (next: Rubric) => void }) {
  const update = (cid: string, patch: Partial<Rubric["criteria"][number]>) =>
    onChange({ criteria: value.criteria.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });

  return (
    <div className="grid gap-4">
      {value.criteria.map((c, ci) => (
        <fieldset key={c.id} className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-xs text-muted-foreground">Criterion {ci + 1}</legend>
          <div className="flex gap-2">
            <Input aria-label={`Criterion ${ci + 1} name`} value={c.title} placeholder="e.g. Argument" onChange={(e) => update(c.id, { title: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ criteria: value.criteria.filter((x) => x.id !== c.id) })} aria-label={`Remove criterion ${ci + 1}`}><Trash2 /></Button>
          </div>
          <div className="grid gap-2">
            {c.levels.map((l, li) => (
              <div key={l.id} className="grid grid-cols-[1fr_5rem_auto] gap-2">
                <Input aria-label={`Criterion ${ci + 1} level ${li + 1} label`} value={l.label} placeholder="Level" onChange={(e) => update(c.id, { levels: c.levels.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })} />
                <Input aria-label={`Criterion ${ci + 1} level ${li + 1} points`} type="number" min={0} step="0.5" value={l.points} onChange={(e) => update(c.id, { levels: c.levels.map((x) => (x.id === l.id ? { ...x, points: Math.max(0, Number(e.target.value) || 0) } : x)) })} />
                <Button type="button" variant="ghost" size="icon" disabled={c.levels.length <= 1} onClick={() => update(c.id, { levels: c.levels.filter((x) => x.id !== l.id) })} aria-label={`Remove level ${li + 1}`}><Trash2 /></Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="ghost" size="sm" disabled={c.levels.length >= 8} onClick={() => update(c.id, { levels: [...c.levels, { id: newId(), label: "", points: 0, description: "" }] })}><Plus /> Add level</Button>
            </div>
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" disabled={value.criteria.length >= 20} onClick={() => onChange({ criteria: [...value.criteria, { ...defaultRubric().criteria[0], title: "" }] })}><Plus /> Add criterion</Button>
        <span className="text-sm text-muted-foreground">Total: {rubricMax(value)} points</span>
      </div>
    </div>
  );
}
