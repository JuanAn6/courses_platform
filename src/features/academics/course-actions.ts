"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { action, command, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { diffObjects } from "@/lib/diff";
import { MAX_UPLOAD_BYTES, sanitizeFilename } from "@/lib/files";
import { storage } from "@/lib/storage";
import { canHoldClassRole, slugify, uniqueSlug } from "./rules";
import { cloneCourseSchema, courseSchema, updateCourseSchema } from "./schemas";

type Tx = Prisma.TransactionClient;

async function assertCodeFree(tx: Tx, code: string, exceptId?: string) {
  const clash = await tx.course.findUnique({ where: { code }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw new UserError(`Course code ${code} is already in use.`);
}

async function freeSlug(tx: Tx, title: string, exceptId?: string) {
  const base = slugify(title);
  const rows = await tx.course.findMany({ where: { slug: { startsWith: base } }, select: { id: true, slug: true } });
  return uniqueSlug(base, new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug)));
}

export const createCourse = action({ permission: "courses.manage", schema: courseSchema }, async (input, actor) => {
  const course = await db.$transaction(async (tx) => {
    await assertCodeFree(tx, input.code);
    const created = await tx.course.create({
      data: { ...input, slug: await freeSlug(tx, input.title), createdById: actor.id },
    });
    await audit({ actorId: actor.id, action: "course.create", entityType: "Course", entityId: created.id }, tx);
    return created;
  });
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
});

export const updateCourse = action({ permission: "courses.manage", schema: updateCourseSchema }, async (input, actor) => {
  const { courseId, ...data } = input;
  await db.$transaction(async (tx) => {
    const before = await tx.course.findUnique({ where: { id: courseId } });
    if (!before) throw new UserError("Course not found.");
    await assertCodeFree(tx, data.code, courseId);
    const slug = data.title === before.title ? before.slug : await freeSlug(tx, data.title, courseId);
    await tx.course.update({ where: { id: courseId }, data: { ...data, slug } });
    const previous = Object.fromEntries(Object.keys(data).map((k) => [k, before[k as keyof typeof before]]));
    const diff = diffObjects(previous, data);
    if (Object.keys(diff.before).length) {
      await audit({ actorId: actor.id, action: "course.update", entityType: "Course", entityId: courseId, diff }, tx);
    }
  });
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/catalog", "layout");
  return { status: "success", message: "Course saved." };
});

export const cloneCourse = action({ permission: "courses.manage", schema: cloneCourseSchema }, async (input, actor) => {
  const created = await db.$transaction(async (tx) => {
    const source = await tx.course.findUnique({ where: { id: input.sourceCourseId }, include: { editors: true } });
    if (!source) throw new UserError("Course not found.");
    await assertCodeFree(tx, input.code);
    const copy = await tx.course.create({
      data: {
        code: input.code,
        title: input.title,
        slug: await freeSlug(tx, input.title),
        summary: source.summary,
        description: source.description,
        level: source.level,
        categoryId: source.categoryId,
        visibility: source.visibility,
        selfEnroll: source.selfEnroll,
        status: "DRAFT",
        createdById: actor.id,
      },
    });
    if (source.editors.length) {
      await tx.courseEditor.createMany({ data: source.editors.map((e) => ({ courseId: copy.id, userId: e.userId })) });
    }
    await copyCourseContent(tx, source.id, copy.id, actor.id);
    await audit(
      { actorId: actor.id, action: "course.clone", entityType: "Course", entityId: copy.id, diff: { from: source.id } },
      tx,
    );
    return copy;
  });
  redirect(`/admin/courses/${created.id}`);
});

/** Copies course-level units and entries (not class-only content); files are shared, not duplicated. */
async function copyCourseContent(tx: Tx, fromCourseId: string, toCourseId: string, actorId: string) {
  const units = await tx.unit.findMany({
    where: { courseId: fromCourseId, classId: null, deletedAt: null },
    include: { entries: { where: { deletedAt: null }, include: { files: true } } },
  });
  const unitIds = new Map<string, string>();
  for (const u of units) {
    const copy = await tx.unit.create({
      data: { courseId: toCourseId, title: u.title, description: u.description, position: u.position, releaseAt: u.releaseAt },
    });
    unitIds.set(u.id, copy.id);
    for (const e of u.entries) {
      const entry = await tx.entry.create({
        data: {
          unitId: copy.id,
          type: e.type,
          title: e.title,
          description: e.description,
          position: e.position,
          status: e.status,
          required: e.required,
          releaseAt: e.releaseAt,
          dueAt: e.dueAt,
          content: e.content as Prisma.InputJsonValue,
          settings: (e.settings ?? undefined) as Prisma.InputJsonValue | undefined,
          createdById: actorId,
        },
      });
      if (e.files.length) await tx.entryFile.createMany({ data: e.files.map((f) => ({ entryId: entry.id, fileId: f.fileId })) });
    }
  }
  for (const u of units) {
    if (u.prerequisiteUnitId && unitIds.has(u.prerequisiteUnitId)) {
      await tx.unit.update({ where: { id: unitIds.get(u.id)! }, data: { prerequisiteUnitId: unitIds.get(u.prerequisiteUnitId)! } });
    }
  }
}

const editorSchema = z.object({ courseId: z.string().min(1), userId: z.string().min(1) });

export const addCourseEditor = command({ permission: "courses.manage", schema: editorSchema }, async (input, actor) => {
  const user = await db.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { roles: { select: { role: true } } },
  });
  if (!user || !canHoldClassRole(user.roles.map((r) => r.role), "TEACHER")) {
    throw new UserError("Only teachers can edit course content.");
  }
  await db.courseEditor.upsert({
    where: { courseId_userId: input },
    create: input,
    update: {},
  });
  await audit({ actorId: actor.id, action: "course.editor.add", entityType: "Course", entityId: input.courseId, diff: { userId: input.userId } });
  revalidatePath(`/admin/courses/${input.courseId}`);
  return { status: "success", message: "Editor added." };
});

export const removeCourseEditor = command({ permission: "courses.manage", schema: editorSchema }, async (input, actor) => {
  await db.courseEditor.deleteMany({ where: input });
  await audit({ actorId: actor.id, action: "course.editor.remove", entityType: "Course", entityId: input.courseId, diff: { userId: input.userId } });
  revalidatePath(`/admin/courses/${input.courseId}`);
  return { status: "success", message: "Editor removed." };
});

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_BYTES = Math.min(MAX_UPLOAD_BYTES, 5 * 1024 * 1024);

const coverSchema = z.object({
  courseId: z.string().min(1),
  cover: z
    .instanceof(File, { message: "Choose an image" })
    .refine((f) => f.size > 0, "Choose an image")
    .refine((f) => f.size <= MAX_COVER_BYTES, "Images can be at most 5 MB")
    .refine((f) => COVER_TYPES.includes(f.type), "Use a JPEG, PNG or WebP image"),
});

export const uploadCourseCover = action({ permission: "courses.manage", schema: coverSchema }, async (input, actor) => {
  const course = await db.course.findUnique({ where: { id: input.courseId }, include: { coverFile: true } });
  if (!course) throw new UserError("Course not found.");

  const name = sanitizeFilename(input.cover.name);
  const key = `course-covers/${course.id}/${crypto.randomUUID()}-${name}`;
  await storage.put(key, new Uint8Array(await input.cover.arrayBuffer()));
  try {
    await db.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: { storageKey: key, originalName: name, mime: input.cover.type, size: input.cover.size, ownerId: actor.id },
      });
      await tx.course.update({ where: { id: course.id }, data: { coverFileId: file.id } });
      if (course.coverFile) await tx.file.delete({ where: { id: course.coverFile.id } });
      await audit({ actorId: actor.id, action: "course.cover.update", entityType: "Course", entityId: course.id }, tx);
    });
  } catch (error) {
    await storage.delete(key);
    throw error;
  }
  if (course.coverFile) await storage.delete(course.coverFile.storageKey);
  revalidatePath(`/admin/courses/${course.id}`);
  return { status: "success", message: "Cover image updated." } satisfies ActionState;
});
