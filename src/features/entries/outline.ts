/**
 * Builds a class's content outline for a viewer (pure): applies per-class overrides, release dates,
 * unit prerequisites and the student's progress. Used by the student outline, the entry player
 * (to check access) and progress calculations.
 */

export type Override = { hidden: boolean; releaseAt: Date | null; dueAt?: Date | null } | null | undefined;

export type OutlineEntryInput = {
  id: string;
  type: string;
  title: string;
  position: number;
  status: "DRAFT" | "PUBLISHED";
  required: boolean;
  releaseAt: Date | null;
  dueAt: Date | null;
  override?: Override;
  progress?: { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; percent: number } | null;
};

export type OutlineUnitInput = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  classId: string | null;
  releaseAt: Date | null;
  prerequisiteUnitId: string | null;
  override?: Override;
  entries: OutlineEntryInput[];
};

export type LockReason = "release" | "prerequisite";

export type OutlineEntry = {
  id: string;
  type: string;
  title: string;
  required: boolean;
  /** Draft or hidden for this class (only present in staff outlines). */
  hidden: boolean;
  locked: boolean;
  lockReason: LockReason | null;
  availableAt: Date | null;
  dueAt: Date | null;
  overdue: boolean;
  completed: boolean;
  percent: number;
};

export type OutlineUnit = {
  id: string;
  title: string;
  description: string | null;
  classOnly: boolean;
  hidden: boolean;
  locked: boolean;
  lockReason: LockReason | null;
  availableAt: Date | null;
  prerequisiteTitle: string | null;
  entries: OutlineEntry[];
  requiredTotal: number;
  requiredDone: number;
};

export type Outline = {
  units: OutlineUnit[];
  requiredTotal: number;
  requiredDone: number;
  /** 0–100, or null when nothing is required. */
  percent: number | null;
  /** First available, not-yet-completed entry, in order. */
  nextEntryId: string | null;
};

const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

function sortUnits(units: OutlineUnitInput[]) {
  // Course units first, then class-only units; each by position.
  return [...units].sort((a, b) => Number(!!a.classId) - Number(!!b.classId) || a.position - b.position);
}

export function buildOutline(input: { units: OutlineUnitInput[]; now: Date; viewer: "student" | "staff" }): Outline {
  const { now, viewer } = input;

  // Pass 1: visibility, dates and completion per unit.
  const prepared = sortUnits(input.units).map((u) => {
    const unitHidden = !!u.override?.hidden;
    const unitAvailableAt = u.override?.releaseAt ?? u.releaseAt;
    const entries = [...u.entries]
      .sort((a, b) => a.position - b.position)
      .map((e) => {
        const hidden = e.status !== "PUBLISHED" || !!e.override?.hidden || unitHidden;
        const availableAt = later(unitAvailableAt, e.override?.releaseAt ?? e.releaseAt);
        const dueAt = e.override?.dueAt ?? e.dueAt;
        const completed = e.progress?.status === "COMPLETED";
        return {
          id: e.id,
          type: e.type,
          title: e.title,
          required: e.required,
          hidden,
          availableAt,
          dueAt,
          completed,
          percent: completed ? 100 : (e.progress?.percent ?? 0),
          overdue: !!dueAt && dueAt < now && !completed,
        };
      });
    const counted = entries.filter((e) => !e.hidden && e.required);
    return {
      unit: u,
      unitHidden,
      unitAvailableAt,
      entries,
      requiredTotal: counted.length,
      requiredDone: counted.filter((e) => e.completed).length,
    };
  });

  const byId = new Map(prepared.map((p) => [p.unit.id, p]));

  // Pass 2: locks (release dates and prerequisites) and viewer filtering.
  const units: OutlineUnit[] = [];
  for (const p of prepared) {
    const prereq = p.unit.prerequisiteUnitId ? byId.get(p.unit.prerequisiteUnitId) : undefined;
    const prereqActive = !!prereq && !prereq.unitHidden && prereq.requiredTotal > 0;
    const prereqLocked = prereqActive && prereq.requiredDone < prereq.requiredTotal;
    const releaseLocked = !!p.unitAvailableAt && p.unitAvailableAt > now;
    const unitLockReason: LockReason | null = releaseLocked ? "release" : prereqLocked ? "prerequisite" : null;

    const entries = p.entries
      .filter((e) => viewer === "staff" || !e.hidden)
      .map((e): OutlineEntry => {
        const entryReleaseLocked = !!e.availableAt && e.availableAt > now;
        const lockReason: LockReason | null = unitLockReason ?? (entryReleaseLocked ? "release" : null);
        return { ...e, locked: lockReason !== null, lockReason };
      });

    if (viewer === "student" && (p.unitHidden || entries.length === 0)) continue;
    units.push({
      id: p.unit.id,
      title: p.unit.title,
      description: p.unit.description,
      classOnly: !!p.unit.classId,
      hidden: p.unitHidden,
      locked: unitLockReason !== null,
      lockReason: unitLockReason,
      availableAt: p.unitAvailableAt,
      prerequisiteTitle: prereqActive ? prereq.unit.title : null,
      entries,
      requiredTotal: p.requiredTotal,
      requiredDone: p.requiredDone,
    });
  }

  const visibleUnits = units.filter((u) => !u.hidden);
  const requiredTotal = visibleUnits.reduce((n, u) => n + u.requiredTotal, 0);
  const requiredDone = visibleUnits.reduce((n, u) => n + u.requiredDone, 0);
  const next = visibleUnits.flatMap((u) => u.entries).find((e) => !e.hidden && !e.locked && !e.completed);

  return {
    units,
    requiredTotal,
    requiredDone,
    percent: requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : null,
    nextEntryId: next?.id ?? null,
  };
}

/** Finds an entry in an outline (with its unit), e.g. to authorize the player. */
export function findEntry(outline: Outline, entryId: string) {
  for (const unit of outline.units) {
    const index = unit.entries.findIndex((e) => e.id === entryId);
    if (index >= 0) return { unit, entry: unit.entries[index] };
  }
  return null;
}

/** Previous/next entries a viewer can open, across units. */
export function neighbors(outline: Outline, entryId: string) {
  const flat = outline.units.filter((u) => !u.hidden).flatMap((u) => u.entries.filter((e) => !e.hidden));
  const i = flat.findIndex((e) => e.id === entryId);
  return { previous: i > 0 ? flat[i - 1] : null, next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null };
}
