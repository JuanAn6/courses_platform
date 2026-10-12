"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { action, command, ForbiddenError, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/session";
import { enqueuePdfConversion } from "@/lib/convert";
import { db } from "@/lib/db";
import { zonedInputToUtc } from "@/lib/timezone";
import { classAccess } from "@/features/academics/rules";
import { getSettings } from "@/features/settings/queries";
import { canEditUnit } from "./access";
import { completeOrder } from "./ordering";
import { contentSchemas, prepareContent, publishProblems, type EntryType } from "./registry";
import { createEntrySchema, createUnitSchema, overrideSchema, reorderSchema, updateEntrySchema, updateUnitSchema } from "./schemas";

type Tx = Prisma.TransactionClient;

async function toUtc(value: string | null) {
  if (!value) return null;
  const { timezone } = await getSettings("general");
  const date = zonedInputToUtc(value, timezone);
  if (!date) throw new UserError("Enter a valid date and time.");
  return date;
}

async function loadEditableUnit(user: CurrentUser, unitId: string) {
  const unit = await db.unit.findFirst({ where: { id: unitId, deletedAt: null } });
  if (!unit) throw new UserError("Unit not found.");
  if (!(await canEditUnit(user, unit))) throw new ForbiddenError();
  return unit;
}

async function loadEditableEntry(user: CurrentUser, entryId: string) {
  const entry = await db.entry.findFirst({ where: { id: entryId, deletedAt: null }, include: { unit: true } });
  if (!entry || entry.unit.deletedAt) throw new UserError("Entry not found.");
  if (!(await canEditUnit(user, entry.unit))) throw new ForbiddenError();
  return entry;
}

/** Where builder pages live, to revalidate after edits. */
function revalidateContent(unit: { courseId: string; classId: string | null }) {
  if (unit.classId) revalidatePath(`/teach/classes/${unit.classId}`, "layout");
  else revalidatePath(`/teach/courses/${unit.courseId}`, "layout");
  revalidatePath("/learn", "layout");
}

// ───────────── Units ─────────────

export const createUnit = command({ schema: createUnitSchema }, async (input, user) => {
  const classId = input.classId ?? null;
  if (classId) {
    const klass = await db.class.findUnique({ where: { id: classId }, select: { courseId: true } });
    if (klass?.courseId !== input.courseId) throw new UserError("Class not found.");
  }
  if (!(await canEditUnit(user, { courseId: input.courseId, classId }))) throw new ForbiddenError();
  const last = await db.unit.findFirst({
    where: { courseId: input.courseId, classId, deletedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const unit = await db.unit.create({
    data: { courseId: input.courseId, classId, title: input.title, position: (last?.position ?? -1) + 1 },
  });
  await audit({ actorId: user.id, action: "unit.create", entityType: "Unit", entityId: unit.id });
  revalidateContent(unit);
  return { status: "success", message: "Unit added." };
});

export const updateUnit = action({ schema: updateUnitSchema }, async (input, user) => {
  const unit = await loadEditableUnit(user, input.unitId);
  if (input.prerequisiteUnitId) {
    if (input.prerequisiteUnitId === unit.id) throw new UserError("A unit can't require itself.");
    const prereq = await db.unit.findFirst({
      where: { id: input.prerequisiteUnitId, courseId: unit.courseId, deletedAt: null },
      select: { classId: true, prerequisiteUnitId: true },
    });
    if (!prereq || (prereq.classId && prereq.classId !== unit.classId)) throw new UserError("Choose a unit from this course.");
    if (prereq.prerequisiteUnitId === unit.id) throw new UserError("Those units would require each other.");
  }
  await db.unit.update({
    where: { id: unit.id },
    data: {
      title: input.title,
      description: input.description,
      releaseAt: await toUtc(input.releaseAt),
      prerequisiteUnitId: input.prerequisiteUnitId,
    },
  });
  await audit({ actorId: user.id, action: "unit.update", entityType: "Unit", entityId: unit.id });
  revalidateContent(unit);
  return { status: "success", message: "Unit saved." };
});

export const deleteUnit = command({ schema: z.object({ unitId: z.string().min(1) }) }, async ({ unitId }, user) => {
  const unit = await loadEditableUnit(user, unitId);
  const now = new Date();
  await db.$transaction([
    db.entry.updateMany({ where: { unitId, deletedAt: null }, data: { deletedAt: now } }),
    db.unit.update({ where: { id: unitId }, data: { deletedAt: now } }),
    db.unit.updateMany({ where: { prerequisiteUnitId: unitId }, data: { prerequisiteUnitId: null } }),
  ]);
  await audit({ actorId: user.id, action: "unit.delete", entityType: "Unit", entityId: unitId, diff: { title: unit.title } });
  revalidateContent(unit);
  return { status: "success", message: "Unit deleted." };
});

export const reorderUnits = command(
  { schema: reorderSchema.extend({ courseId: z.string().min(1), classId: z.string().min(1).nullish() }) },
  async ({ ids, courseId, classId }, user) => {
    const scope = { courseId, classId: classId ?? null };
    if (!(await canEditUnit(user, scope))) throw new ForbiddenError();
    const units = await db.unit.findMany({
      where: { ...scope, deletedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const order = completeOrder(ids, units.map((u) => u.id));
    if (!order) throw new UserError("Some units couldn't be found. Reload and try again.");
    await db.$transaction(order.map((id, position) => db.unit.update({ where: { id }, data: { position } })));
    revalidateContent(scope);
    return { status: "success" };
  },
);

// ───────────── Entries ─────────────

export const createEntry = command({ schema: createEntrySchema }, async ({ unitId, type }, user) => {
  const unit = await loadEditableUnit(user, unitId);
  const last = await db.entry.findFirst({ where: { unitId, deletedAt: null }, orderBy: { position: "desc" }, select: { position: true } });
  const entry = await db.entry.create({
    data: {
      unitId,
      type,
      title: `Untitled ${type.toLowerCase()}`,
      position: (last?.position ?? -1) + 1,
      content: contentSchemas[type].parse({}) as Prisma.InputJsonValue,
      createdById: user.id,
    },
  });
  await audit({ actorId: user.id, action: "entry.create", entityType: "Entry", entityId: entry.id, diff: { type } });
  revalidateContent(unit);
  redirect(`/teach/entries/${entry.id}`);
});

/** New file references must belong to the editor, or already be used in this course's content. */
async function assertAttachable(tx: Tx, user: CurrentUser, entry: { id: string; unit: { courseId: string } }, fileIds: string[]) {
  if (!fileIds.length) return;
  const files = await tx.file.findMany({
    where: { id: { in: fileIds } },
    select: {
      id: true,
      ownerId: true,
      studentDocument: { select: { id: true } },
      entries: { select: { entry: { select: { id: true, unit: { select: { courseId: true } } } } } },
    },
  });
  if (files.length !== fileIds.length) throw new UserError("Some attached files no longer exist. Upload them again.");
  for (const f of files) {
    if (f.studentDocument) throw new UserError("That file can't be attached.");
    const ok =
      f.ownerId === user.id ||
      user.roles.includes("ADMIN") ||
      f.entries.some((r) => r.entry.id === entry.id || r.entry.unit.courseId === entry.unit.courseId);
    if (!ok) throw new UserError("You can only attach files you uploaded.");
  }
}

export const updateEntry = action({ schema: updateEntrySchema }, async (input, user) => {
  const entry = await loadEditableEntry(user, input.entryId);
  const type = entry.type as EntryType;

  let raw: unknown;
  try {
    raw = JSON.parse(input.content);
  } catch {
    throw new UserError("The content couldn't be read. Reload and try again.");
  }
  const parsed = contentSchemas[type].safeParse(raw);
  if (!parsed.success) throw new UserError("Some content settings are invalid.");
  const { content, fileIds } = prepareContent(type, parsed.data);

  if (input.status === "PUBLISHED") {
    const problems = publishProblems(type, content);
    if (problems.length) {
      return { status: "error", message: `Can't publish yet: ${problems.join(" ")}`, fieldErrors: { status: problems } };
    }
  }

  await db.$transaction(async (tx) => {
    await assertAttachable(tx, user, entry, fileIds);
    await tx.entry.update({
      where: { id: entry.id },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        required: input.required,
        releaseAt: await toUtc(input.releaseAt),
        dueAt: await toUtc(input.dueAt),
        content: content as Prisma.InputJsonValue,
      },
    });
    await tx.entryFile.deleteMany({ where: { entryId: entry.id, fileId: { notIn: fileIds } } });
    await tx.entryFile.createMany({ data: fileIds.map((fileId) => ({ entryId: entry.id, fileId })), skipDuplicates: true });
    await audit(
      {
        actorId: user.id,
        action: entry.status !== input.status ? `entry.${input.status === "PUBLISHED" ? "publish" : "unpublish"}` : "entry.update",
        entityType: "Entry",
        entityId: entry.id,
      },
      tx,
    );
  });
  revalidateContent(entry.unit);
  revalidatePath(`/teach/entries/${entry.id}`);
  return { status: "success", message: input.status === "PUBLISHED" ? "Saved and published." : "Saved as draft." };
});

export const deleteEntry = command({ schema: z.object({ entryId: z.string().min(1) }) }, async ({ entryId }, user) => {
  const entry = await loadEditableEntry(user, entryId);
  await db.entry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });
  await audit({ actorId: user.id, action: "entry.delete", entityType: "Entry", entityId: entryId, diff: { title: entry.title } });
  revalidateContent(entry.unit);
  redirect(entry.unit.classId ? `/teach/classes/${entry.unit.classId}/content` : `/teach/courses/${entry.unit.courseId}`);
});

/** Reorders entries within a unit; entries from another unit (same scope) are moved into it. */
export const reorderEntries = command(
  { schema: reorderSchema.extend({ unitId: z.string().min(1) }) },
  async ({ ids, unitId }, user) => {
    const unit = await loadEditableUnit(user, unitId);
    const moved = await db.entry.findMany({
      where: { id: { in: ids }, deletedAt: null, unit: { courseId: unit.courseId, classId: unit.classId, deletedAt: null } },
      select: { id: true },
    });
    if (moved.length !== new Set(ids).size) throw new UserError("Some entries couldn't be found. Reload and try again.");
    const current = await db.entry.findMany({
      where: { unitId, deletedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const order = completeOrder(ids, [...new Set([...ids, ...current.map((e) => e.id)])]);
    if (!order) throw new UserError("Some entries couldn't be found. Reload and try again.");
    await db.$transaction(order.map((id, position) => db.entry.update({ where: { id }, data: { position, unitId } })));
    revalidateContent(unit);
    return { status: "success" };
  },
);

export const retryConversion = command({ schema: z.object({ fileId: z.string().min(1) }) }, async ({ fileId }, user) => {
  const file = await db.file.findUnique({ where: { id: fileId } });
  if (!file || (file.ownerId !== user.id && !user.roles.includes("ADMIN"))) throw new UserError("File not found.");
  if (file.status === "READY") return { status: "success", message: "Already converted." };
  await db.file.update({ where: { id: fileId }, data: { status: "PROCESSING", derived: {} } });
  void enqueuePdfConversion(fileId);
  return { status: "success", message: "Converting again…" };
});

// ───────────── Class overrides ─────────────

export const setOverride = command({ schema: overrideSchema }, async (input, user) => {
  const klass = await db.class.findUnique({ where: { id: input.classId }, select: { courseId: true, status: true } });
  if (!klass) throw new UserError("Class not found.");
  const membership = await db.classMember.findUnique({
    where: { classId_userId: { classId: input.classId, userId: user.id } },
    select: { role: true, status: true },
  });
  if (!classAccess({ roles: user.roles, membership, classStatus: klass.status }).isTeacher) throw new ForbiddenError();

  const releaseAt = await toUtc(input.releaseAt);
  if (input.kind === "unit") {
    const unit = await db.unit.findFirst({ where: { id: input.targetId, courseId: klass.courseId, classId: null, deletedAt: null } });
    if (!unit) throw new UserError("Unit not found.");
    const data = { hidden: input.hidden, releaseAt };
    if (!data.hidden && !data.releaseAt) await db.unitClassOverride.deleteMany({ where: { unitId: unit.id, classId: input.classId } });
    else
      await db.unitClassOverride.upsert({
        where: { unitId_classId: { unitId: unit.id, classId: input.classId } },
        create: { unitId: unit.id, classId: input.classId, ...data },
        update: data,
      });
  } else {
    const entry = await db.entry.findFirst({
      where: { id: input.targetId, deletedAt: null, unit: { courseId: klass.courseId, classId: null } },
    });
    if (!entry) throw new UserError("Entry not found.");
    const data = { hidden: input.hidden, releaseAt, dueAt: await toUtc(input.dueAt) };
    if (!data.hidden && !data.releaseAt && !data.dueAt) {
      await db.entryClassOverride.deleteMany({ where: { entryId: entry.id, classId: input.classId } });
    } else
      await db.entryClassOverride.upsert({
        where: { entryId_classId: { entryId: entry.id, classId: input.classId } },
        create: { entryId: entry.id, classId: input.classId, ...data },
        update: data,
      });
  }
  await audit({
    actorId: user.id,
    action: "class.override",
    entityType: "Class",
    entityId: input.classId,
    diff: { kind: input.kind, targetId: input.targetId, hidden: input.hidden, releaseAt: input.releaseAt, dueAt: input.dueAt },
  });
  revalidatePath(`/teach/classes/${input.classId}`, "layout");
  revalidatePath(`/learn/classes/${input.classId}`, "layout");
  return { status: "success", message: "Saved for this class." };
});
