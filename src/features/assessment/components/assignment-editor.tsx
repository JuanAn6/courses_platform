"use client";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { RichTextEditor } from "@/features/entries/rich-text/rich-text-editor";
import type { EntryContent } from "@/features/entries/registry";
import { defaultRubric, RubricEditor } from "./rubric-editor";

type Content = EntryContent<"ASSIGNMENT">;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

export function AssignmentEditor({ value, onChange }: { value: Content; onChange: (next: Content) => void }) {
  const set = (patch: Partial<Content>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Instructions</span>
        <RichTextEditor value={value.instructions} onChange={(instructions) => set({ instructions })} placeholder="Explain what students should do…" label="Instructions" />
      </div>

      <section className="grid gap-3" aria-labelledby="submission-settings">
        <h3 id="submission-settings" className="text-sm font-semibold">Submissions</h3>
        <div className="flex flex-wrap gap-6">
          <Toggle label="Students can write text" checked={value.allowText} onChange={(allowText) => set({ allowText })} />
          <Toggle label="Students can upload files" checked={value.allowFiles} onChange={(allowFiles) => set({ allowFiles })} />
          <Toggle label="Allow resubmitting" checked={value.allowResubmission} onChange={(allowResubmission) => set({ allowResubmission })} />
        </div>
        {value.allowFiles ? (
          <FormField id="maxFiles" label="Files allowed">
            <Input id="maxFiles" type="number" min={1} max={10} className="w-24" value={value.maxFiles} onChange={(e) => set({ maxFiles: Math.min(10, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
          </FormField>
        ) : null}
      </section>

      <section className="grid gap-3" aria-labelledby="grading-settings">
        <h3 id="grading-settings" className="text-sm font-semibold">Grading</h3>
        <Toggle label="Grade with a rubric" checked={!!value.rubric} onChange={(on) => set({ rubric: on ? defaultRubric() : null })} />
        {value.rubric ? (
          <RubricEditor value={value.rubric} onChange={(rubric) => set({ rubric })} />
        ) : (
          <FormField id="assignmentPoints" label="Points">
            <Input id="assignmentPoints" type="number" min={0} step="0.5" className="w-28" value={value.points} onChange={(e) => set({ points: Math.max(0, Number(e.target.value) || 0) })} />
          </FormField>
        )}
      </section>
    </div>
  );
}
