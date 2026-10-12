"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";
import { createEntry, createUnit, deleteUnit, reorderEntries, reorderUnits, updateUnit } from "../actions";
import { ENTRY_TYPE_INFO, ENTRY_TYPES } from "../registry";
import { EntryIcon } from "./entry-icon";

export type BuilderEntry = {
  id: string;
  type: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  required: boolean;
  releaseLabel: string | null;
  dueLabel: string | null;
};
export type BuilderUnit = {
  id: string;
  title: string;
  description: string | null;
  releaseAt: string;
  releaseLabel: string | null;
  prerequisiteUnitId: string | null;
  entries: BuilderEntry[];
};

function report(res: ActionState<unknown> | undefined) {
  if (res?.status === "error") toast.error(res.message);
  return res?.status === "success";
}

/** Editable outline for course content (classId null) or a class's own units. */
export function ContentBuilder({
  courseId,
  classId = null,
  units: initialUnits,
  timezone,
}: {
  courseId: string;
  classId?: string | null;
  units: BuilderUnit[];
  timezone: string;
}) {
  // Local copy for optimistic reordering; reset whenever the server sends fresh data.
  const [units, setUnits] = useState(initialUnits);
  const [source, setSource] = useState(initialUnits);
  if (source !== initialUnits) {
    setSource(initialUnits);
    setUnits(initialUnits);
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const saveUnitOrder = async (next: BuilderUnit[]) => {
    const previous = units;
    setUnits(next);
    if (!report(await reorderUnits({ courseId, classId, ids: next.map((u) => u.id) }))) setUnits(previous);
  };
  const saveEntryOrder = async (unitId: string, entries: BuilderEntry[]) => {
    const previous = units;
    setUnits((us) => us.map((u) => (u.id === unitId ? { ...u, entries } : u)));
    if (!report(await reorderEntries({ unitId, ids: entries.map((e) => e.id) }))) setUnits(previous);
  };

  const onUnitDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = units.findIndex((u) => u.id === active.id);
    const to = units.findIndex((u) => u.id === over.id);
    if (from >= 0 && to >= 0) void saveUnitOrder(arrayMove(units, from, to));
  };

  return (
    <div className="grid gap-4">
      {units.length === 0 ? <p className="text-sm text-muted-foreground">No units yet. Add the first one below.</p> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onUnitDragEnd}>
        <SortableContext items={units.map((u) => u.id)} strategy={verticalListSortingStrategy}>
          {units.map((unit, i) => (
            <SortableUnit
              key={unit.id}
              unit={unit}
              index={i}
              count={units.length}
              allUnits={units}
              timezone={timezone}
              onMove={(d) => void saveUnitOrder(arrayMove(units, i, i + d))}
              onEntriesReordered={(entries) => void saveEntryOrder(unit.id, entries)}
              sensors={sensors}
            />
          ))}
        </SortableContext>
      </DndContext>
      <AddUnit courseId={courseId} classId={classId} />
    </div>
  );
}

function AddUnit({ courseId, classId }: { courseId: string; classId: string | null }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          if (report(await createUnit({ courseId, classId, title }))) setTitle("");
        });
      }}
    >
      <label htmlFor={`new-unit-${classId ?? courseId}`} className="sr-only">New unit title</label>
      <Input id={`new-unit-${classId ?? courseId}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New unit title, e.g. Unit 1: Introduction" />
      <Button type="submit" disabled={pending || !title.trim()}><Plus /> Add unit</Button>
    </form>
  );
}

function SortableUnit({
  unit,
  index,
  count,
  allUnits,
  timezone,
  onMove,
  onEntriesReordered,
  sensors,
}: {
  unit: BuilderUnit;
  index: number;
  count: number;
  allUnits: BuilderUnit[];
  timezone: string;
  onMove: (delta: number) => void;
  onEntriesReordered: (entries: BuilderEntry[]) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: unit.id });
  const prerequisite = allUnits.find((u) => u.id === unit.prerequisiteUnitId);

  const onEntryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = unit.entries.findIndex((e) => e.id === active.id);
    const to = unit.entries.findIndex((e) => e.id === over.id);
    if (from >= 0 && to >= 0) onEntriesReordered(arrayMove(unit.entries, from, to));
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-80" : undefined}
      aria-label={`Unit: ${unit.title}`}
    >
      <Card className="gap-3">
        <CardHeader className="flex flex-row items-start gap-2">
          <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="mt-1 cursor-grab rounded text-muted-foreground hover:text-foreground" aria-label={`Drag unit ${unit.title}`}>
            <GripVertical className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{unit.title}</h2>
            <p className="text-xs text-muted-foreground">
              {unit.entries.length} item{unit.entries.length === 1 ? "" : "s"}
              {unit.releaseLabel ? ` · Opens ${unit.releaseLabel}` : ""}
              {prerequisite ? ` · After “${prerequisite.title}”` : ""}
            </p>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move unit ${unit.title} up`}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move unit ${unit.title} down`}><ArrowDown /></Button>
            <UnitSettings unit={unit} units={allUnits} timezone={timezone} />
            <ConfirmButton
              variant="ghost"
              run={() => deleteUnit({ unitId: unit.id })}
              label={<><Trash2 /><span className="sr-only">Delete unit {unit.title}</span></>}
              title={`Delete “${unit.title}”?`}
              description="The unit and everything in it are removed from the course. Student progress on it no longer counts."
              confirmLabel="Delete"
              destructive
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEntryDragEnd}>
            <SortableContext items={unit.entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <ul className="grid gap-1">
                {unit.entries.map((entry, i) => (
                  <SortableEntry
                    key={entry.id}
                    entry={entry}
                    first={i === 0}
                    last={i === unit.entries.length - 1}
                    onMove={(d) => onEntriesReordered(arrayMove(unit.entries, i, i + d))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <AddEntryMenu unitId={unit.id} unitTitle={unit.title} />
        </CardContent>
      </Card>
    </section>
  );
}

function SortableEntry({ entry, first, last, onMove }: { entry: BuilderEntry; first: boolean; last: boolean; onMove: (d: number) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 ${isDragging ? "relative z-10 shadow" : ""}`}
    >
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab rounded text-muted-foreground hover:text-foreground" aria-label={`Drag ${entry.title}`}>
        <GripVertical className="size-4" />
      </button>
      <EntryIcon type={entry.type} />
      <Link href={`/teach/entries/${entry.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
        {entry.title}
      </Link>
      <span className="hidden text-xs text-muted-foreground md:inline">
        {entry.releaseLabel ? `Opens ${entry.releaseLabel}` : ""}
        {entry.dueLabel ? ` · Due ${entry.dueLabel}` : ""}
      </span>
      {!entry.required ? <Badge variant="outline">Optional</Badge> : null}
      {entry.status === "DRAFT" ? <Badge variant="secondary" className="bg-amber-500/15 text-amber-800 dark:text-amber-400">Draft</Badge> : null}
      <Button variant="ghost" size="icon" className="size-7" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${entry.title} up`}><ArrowUp /></Button>
      <Button variant="ghost" size="icon" className="size-7" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${entry.title} down`}><ArrowDown /></Button>
    </li>
  );
}

function AddEntryMenu({ unitId, unitTitle }: { unitId: string; unitTitle: string }) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" disabled={pending} aria-label={`Add content to ${unitTitle}`}>
          <Plus /> Add content
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {ENTRY_TYPES.map((type) => (
          <DropdownMenuItem key={type} onSelect={() => start(async () => void report(await createEntry({ unitId, type })))} className="items-start">
            <EntryIcon type={type} className="mt-0.5 size-4" />
            <span>
              <span className="font-medium">{ENTRY_TYPE_INFO[type].label}</span>
              <span className="block text-xs text-muted-foreground">{ENTRY_TYPE_INFO[type].description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const initial: ActionState = { status: "idle" };

function UnitSettings({ unit, units, timezone }: { unit: BuilderUnit; units: BuilderUnit[]; timezone: string }) {
  const [open, setOpen] = useState(false);
  const { state, formAction, onSubmit, pending } = useActionForm(updateUnit, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(state, () => setOpen(false), { toastErrors: false });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Settings for unit ${unit.title}`}><Settings2 /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unit settings</DialogTitle>
          <DialogDescription>Name, introduction and when it becomes available.</DialogDescription>
        </DialogHeader>
        <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="unitId" value={unit.id} />
          <FormField id={`unit-title-${unit.id}`} label="Title" error={errors?.title}>
            <Input id={`unit-title-${unit.id}`} name="title" defaultValue={unit.title} />
          </FormField>
          <FormField id={`unit-desc-${unit.id}`} label="Introduction" error={errors?.description} hint="Optional.">
            <Textarea id={`unit-desc-${unit.id}`} name="description" rows={3} defaultValue={unit.description ?? ""} />
          </FormField>
          <FormField id={`unit-release-${unit.id}`} label="Available from" error={errors?.releaseAt} hint={`Optional. Times are in ${timezone}.`}>
            <Input id={`unit-release-${unit.id}`} name="releaseAt" type="datetime-local" defaultValue={unit.releaseAt} />
          </FormField>
          <FormField id={`unit-prereq-${unit.id}`} label="Requires completing" error={errors?.prerequisiteUnitId}>
            <NativeSelect id={`unit-prereq-${unit.id}`} name="prerequisiteUnitId" defaultValue={unit.prerequisiteUnitId ?? ""}>
              <option value="">Nothing (always open)</option>
              {units.filter((u) => u.id !== unit.id).map((u) => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </NativeSelect>
          </FormField>
          {state.status === "error" && !errors ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save unit"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
