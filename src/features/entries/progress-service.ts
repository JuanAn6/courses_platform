import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/** Marks an entry completed for a student (used when a quiz or assignment is submitted). */
export async function markEntryCompleted(
  input: { userId: string; entryId: string; classId: string },
  tx: Prisma.TransactionClient = db,
) {
  const now = new Date();
  await tx.entryProgress.upsert({
    where: { userId_entryId_classId: input },
    create: { ...input, status: "COMPLETED", percent: 100, completedAt: now },
    update: { status: "COMPLETED", percent: 100, completedAt: now },
  });
}
