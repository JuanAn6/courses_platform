import "server-only";
import type { Prisma, QuestionType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { parseTags } from "./tags";

export async function listQuestions(courseId: string, opts: { q?: string; type?: QuestionType; tag?: string } = {}) {
  const where: Prisma.QuestionWhereInput = {
    courseId,
    deletedAt: null,
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.tag ? { tags: { contains: `,${opts.tag},` } } : {}),
    ...(opts.q ? { OR: [{ explanation: { contains: opts.q } }, { tags: { contains: opts.q } }] } : {}),
  };
  const rows = await db.question.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, type: true, prompt: true, points: true, tags: true, difficulty: true, updatedAt: true },
  });
  return rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));
}

/** All tags used in a course's bank, with counts. */
export async function bankTags(courseId: string) {
  const rows = await db.question.findMany({ where: { courseId, deletedAt: null }, select: { tags: true } });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of parseTags(r.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

export function getQuestion(id: string) {
  return db.question.findFirst({ where: { id, deletedAt: null } });
}
