import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import type { UserStatusFilter } from "./schemas";

export const USERS_PAGE_SIZE = 25;

export async function listUsers(opts: {
  q?: string;
  role?: Role;
  status?: UserStatusFilter;
  cursor?: string;
}) {
  const where: Prisma.UserWhereInput = {};
  const status = opts.status ?? "all";
  if (status === "archived") where.deletedAt = { not: null };
  else {
    where.deletedAt = null;
    if (status !== "all") where.status = status.toUpperCase() as "ACTIVE" | "INVITED" | "SUSPENDED";
  }
  if (opts.role) where.roles = { some: { role: opts.role } };
  if (opts.q) where.OR = [{ name: { contains: opts.q } }, { email: { contains: opts.q } }];

  const rows = await db.user.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: USERS_PAGE_SIZE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      deletedAt: true,
      lastLoginAt: true,
      roles: { select: { role: true } },
    },
  });
  return {
    users: rows.slice(0, USERS_PAGE_SIZE).map((u) => ({ ...u, roles: u.roles.map((r) => r.role) })),
    nextCursor: rows.length > USERS_PAGE_SIZE ? rows[USERS_PAGE_SIZE - 1].id : null,
  };
}

export async function getUserDetail(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      roles: { select: { role: true } },
      studentProfile: { select: { studentCode: true } },
      accounts: { select: { providerId: true } },
      _count: { select: { sessions: true } },
    },
  });
  if (!user) return null;
  const recentActivity = await db.auditLog.findMany({
    where: { OR: [{ entityType: "User", entityId: id }, { actorId: id }] },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actor: { select: { name: true } } },
  });
  return {
    ...user,
    roles: user.roles.map((r) => r.role),
    hasPassword: user.accounts.some((a) => a.providerId === "credential"),
    activeSessions: user._count.sessions,
    recentActivity,
  };
}
