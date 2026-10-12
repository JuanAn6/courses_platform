import "server-only";
import { db } from "@/lib/db";
import { buildOutline, type OutlineUnitInput } from "./outline";
import { referencedFiles, type AnyEntryContent, type EntryType } from "./registry";

const liveEntries = { where: { deletedAt: null }, orderBy: { position: "asc" as const } };

/** Units in scope for a class (course units + class-only units), or a course's own units. */
function unitScope(courseId: string, classId?: string | null) {
  return {
    courseId,
    deletedAt: null,
    ...(classId ? { OR: [{ classId: null }, { classId }] } : { classId: null }),
  };
}

/** Everything the course builder / class content page needs. */
export async function getBuilderData(courseId: string, classId?: string | null) {
  const units = await db.unit.findMany({
    where: unitScope(courseId, classId),
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      entries: { ...liveEntries, select: { id: true, type: true, title: true, status: true, required: true, releaseAt: true, dueAt: true, position: true } },
      ...(classId ? { overrides: { where: { classId } } } : {}),
    },
  });
  const entryOverrides = classId
    ? await db.entryClassOverride.findMany({ where: { classId, entry: { unit: { courseId } } } })
    : [];
  return { units, entryOverrides };
}

/** Raw outline input for a class (no per-student progress). */
export async function getClassOutlineInput(classId: string, courseId: string): Promise<OutlineUnitInput[]> {
  const [units, entryOverrides, unitOverrides] = await Promise.all([
    db.unit.findMany({
      where: unitScope(courseId, classId),
      include: { entries: { ...liveEntries, select: { id: true, type: true, title: true, position: true, status: true, required: true, releaseAt: true, dueAt: true } } },
    }),
    db.entryClassOverride.findMany({ where: { classId } }),
    db.unitClassOverride.findMany({ where: { classId } }),
  ]);
  const eo = new Map(entryOverrides.map((o) => [o.entryId, o]));
  const uo = new Map(unitOverrides.map((o) => [o.unitId, o]));
  return units.map((u) => ({
    id: u.id,
    title: u.title,
    description: u.description,
    position: u.position,
    classId: u.classId,
    releaseAt: u.releaseAt,
    prerequisiteUnitId: u.prerequisiteUnitId,
    override: uo.get(u.id) ?? null,
    entries: u.entries.map((e) => ({ ...e, override: eo.get(e.id) ?? null })),
  }));
}

type ProgressRow = { entryId: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; percent: number };

function withProgress(units: OutlineUnitInput[], progress: ProgressRow[]): OutlineUnitInput[] {
  const byEntry = new Map(progress.map((p) => [p.entryId, p]));
  return units.map((u) => ({ ...u, entries: u.entries.map((e) => ({ ...e, progress: byEntry.get(e.id) ?? null })) }));
}

/** The student's outline for a class (visibility, locks and progress applied). */
export async function getStudentOutline(classId: string, courseId: string, userId: string, now = new Date()) {
  const [units, progress] = await Promise.all([
    getClassOutlineInput(classId, courseId),
    db.entryProgress.findMany({ where: { classId, userId }, select: { entryId: true, status: true, percent: true } }),
  ]);
  return buildOutline({ units: withProgress(units, progress), now, viewer: "student" });
}

/** Per-student progress for a class roster. */
export async function getClassProgress(classId: string, courseId: string, studentIds: string[], now = new Date()) {
  const [units, progress] = await Promise.all([
    getClassOutlineInput(classId, courseId),
    db.entryProgress.findMany({
      where: { classId, userId: { in: studentIds } },
      select: { userId: true, entryId: true, status: true, percent: true, updatedAt: true },
    }),
  ]);
  return new Map(
    studentIds.map((id) => {
      const mine = progress.filter((p) => p.userId === id);
      const outline = buildOutline({ units: withProgress(units, mine), now, viewer: "student" });
      const lastActivity = mine.reduce<Date | null>((a, p) => (!a || p.updatedAt > a ? p.updatedAt : a), null);
      return [id, { percent: outline.percent, done: outline.requiredDone, total: outline.requiredTotal, lastActivity }];
    }),
  );
}

export async function getEntryForEdit(entryId: string) {
  const entry = await db.entry.findFirst({
    where: { id: entryId, deletedAt: null, unit: { deletedAt: null } },
    include: {
      unit: {
        include: {
          course: { select: { id: true, title: true, code: true } },
          class: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!entry) return null;
  const units = await db.unit.findMany({
    where: { courseId: entry.unit.courseId, classId: entry.unit.classId, deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true, title: true, entries: { where: { deletedAt: null }, orderBy: { position: "asc" }, select: { id: true } } },
  });
  const files = await getFilesInfo(referencedFiles(entry.type as EntryType, entry.content as AnyEntryContent));
  return { entry, units, files };
}

export type FileInfo = {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: "READY" | "PROCESSING" | "FAILED";
  pdfFileId: string | null;
  error: string | null;
};

export async function getFilesInfo(ids: string[]): Promise<FileInfo[]> {
  if (!ids.length) return [];
  const rows = await db.file.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((f) => [f.id, f]));
  return ids.flatMap((id) => {
    const f = byId.get(id);
    if (!f) return [];
    const derived = (f.derived ?? {}) as { pdfFileId?: string; error?: string };
    return [{ id: f.id, name: f.originalName, mime: f.mime, size: f.size, status: f.status, pdfFileId: derived.pdfFileId ?? null, error: derived.error ?? null }];
  });
}

/** Entry content for the player. */
export function getEntry(entryId: string) {
  return db.entry.findFirst({ where: { id: entryId, deletedAt: null }, include: { unit: { select: { title: true } } } });
}

export function getProgress(userId: string, entryId: string, classId: string) {
  return db.entryProgress.findUnique({ where: { userId_entryId_classId: { userId, entryId, classId } } });
}
