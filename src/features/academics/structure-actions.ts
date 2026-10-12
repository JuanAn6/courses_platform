"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, command, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { diffObjects } from "@/lib/diff";
import { slugify, uniqueSlug } from "./rules";
import { categorySchema, termSchema } from "./schemas";

// ───────────── Categories ─────────────

async function assertNoCycle(categoryId: string, parentId: string | null) {
  let current = parentId;
  while (current) {
    if (current === categoryId) throw new UserError("A category can't be placed inside itself.");
    const parent = await db.category.findUnique({ where: { id: current }, select: { parentId: true } });
    current = parent?.parentId ?? null;
  }
}

export const saveCategory = action({ permission: "courses.manage", schema: categorySchema }, async (input, actor) => {
  if (input.parentId && !(await db.category.findUnique({ where: { id: input.parentId } }))) {
    throw new UserError("Parent category not found.");
  }
  if (input.id) {
    const before = await db.category.findUnique({ where: { id: input.id } });
    if (!before) throw new UserError("Category not found.");
    await assertNoCycle(input.id, input.parentId);
    const data = { name: input.name, description: input.description, parentId: input.parentId };
    await db.category.update({ where: { id: input.id }, data });
    await audit({
      actorId: actor.id,
      action: "category.update",
      entityType: "Category",
      entityId: input.id,
      diff: diffObjects({ name: before.name, description: before.description, parentId: before.parentId }, data),
    });
  } else {
    const taken = new Set((await db.category.findMany({ select: { slug: true } })).map((c) => c.slug));
    const created = await db.category.create({
      data: {
        name: input.name,
        description: input.description,
        parentId: input.parentId,
        slug: uniqueSlug(slugify(input.name), taken),
      },
    });
    await audit({ actorId: actor.id, action: "category.create", entityType: "Category", entityId: created.id });
  }
  revalidatePath("/admin/categories");
  return { status: "success", message: input.id ? "Category saved." : "Category created." };
});

export const deleteCategory = command(
  { permission: "courses.manage", schema: z.object({ id: z.string().min(1) }) },
  async ({ id }, actor) => {
    const category = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, courses: true } } },
    });
    if (!category) throw new UserError("Category not found.");
    if (category._count.children) throw new UserError("Move or delete its subcategories first.");
    if (category._count.courses) throw new UserError("Move its courses to another category first.");
    await db.category.delete({ where: { id } });
    await audit({ actorId: actor.id, action: "category.delete", entityType: "Category", entityId: id, diff: { name: category.name } });
    revalidatePath("/admin/categories");
    return { status: "success", message: "Category deleted." };
  },
);

// ───────────── Terms ─────────────

export const saveTerm = action({ permission: "courses.manage", schema: termSchema }, async (input, actor) => {
  const clash = await db.academicTerm.findUnique({ where: { name: input.name } });
  if (clash && clash.id !== input.id) throw new UserError("Another term already has this name.");
  const data = { name: input.name, startDate: input.startDate, endDate: input.endDate };
  if (input.id) {
    const before = await db.academicTerm.findUnique({ where: { id: input.id } });
    if (!before) throw new UserError("Term not found.");
    await db.academicTerm.update({ where: { id: input.id }, data });
    await audit({
      actorId: actor.id,
      action: "term.update",
      entityType: "AcademicTerm",
      entityId: input.id,
      diff: diffObjects({ name: before.name, startDate: before.startDate, endDate: before.endDate }, data),
    });
  } else {
    const created = await db.academicTerm.create({ data });
    await audit({ actorId: actor.id, action: "term.create", entityType: "AcademicTerm", entityId: created.id });
  }
  revalidatePath("/admin/terms");
  return { status: "success", message: input.id ? "Term saved." : "Term created." };
});

export const deleteTerm = command(
  { permission: "courses.manage", schema: z.object({ id: z.string().min(1) }) },
  async ({ id }, actor) => {
    const term = await db.academicTerm.findUnique({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (!term) throw new UserError("Term not found.");
    if (term._count.classes) throw new UserError("This term has classes. Move them to another term first.");
    await db.academicTerm.delete({ where: { id } });
    await audit({ actorId: actor.id, action: "term.delete", entityType: "AcademicTerm", entityId: id, diff: { name: term.name } });
    revalidatePath("/admin/terms");
    return { status: "success", message: "Term deleted." };
  },
);
