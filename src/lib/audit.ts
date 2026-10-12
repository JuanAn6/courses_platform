import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type AuditEntry = {
  actorId: string | null;
  /** Dotted verb, e.g. "settings.update", "user.suspend". */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Changed fields; for updates use diffObjects() from "@/lib/diff". Must be JSON-serializable. */
  diff?: Record<string, unknown>;
};

/** Records a mutation of important data. Pass `tx` to write inside a transaction. */
export async function audit(entry: AuditEntry, tx: Prisma.TransactionClient = db) {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    userAgent = h.get("user-agent");
  } catch {
    // Outside a request (scripts, jobs): no headers available.
  }

  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      diff: entry.diff as Prisma.InputJsonValue | undefined,
      ip,
      userAgent,
    },
  });
}

