import "server-only";
import type { Prisma, Role } from "@/generated/prisma/client";
import { UserError } from "@/lib/actions";
import { db } from "@/lib/db";
import { getSettings } from "@/features/settings/queries";
import { formatStudentCode, highestSequence, studentCodePrefix } from "@/features/students/student-code";
import { issueAccountToken, sendAccountEmail } from "./tokens";

type Tx = Prisma.TransactionClient;

/** Throws a UserError when the email belongs to another account (including archived ones). */
export async function assertEmailAvailable(tx: Tx, email: string, exceptUserId?: string) {
  const existing = await tx.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
  if (!existing || existing.id === exceptUserId) return;
  throw new UserError(
    existing.deletedAt
      ? "An archived account uses this email. Restore it from Administration → Users instead."
      : "Another account already uses this email.",
  );
}

/**
 * Creates a counter if missing. Runs on the base client (autocommit) and must be called
 * BEFORE the transaction that uses the counter: two transactions probing a missing row take
 * gap locks and deadlock on insert, and borrowing a second connection from inside a
 * transaction can exhaust the pool under load.
 */
async function ensureSequence(name: string, initial: () => Promise<number>) {
  if (await db.sequence.findUnique({ where: { name }, select: { name: true } })) return;
  await db.$executeRaw`INSERT IGNORE INTO sequences (name, value) VALUES (${name}, ${await initial()})`;
}

/**
 * Atomically increments an existing counter and returns the new value. Raw SQL on purpose:
 * UPDATE is a locking "current read" in InnoDB, so it sees rows committed by concurrent
 * transactions (Prisma's update() would first do a snapshot read and could miss them).
 * The row stays locked until the transaction ends, so callers get distinct values.
 */
async function nextSequenceValue(tx: Tx, name: string): Promise<number> {
  const updated = await tx.$executeRaw`UPDATE sequences SET value = value + 1 WHERE name = ${name}`;
  if (updated !== 1) {
    throw new Error(`Sequence ${name} does not exist. Call ensureStudentCodeSequence() before the transaction.`);
  }
  const rows = await tx.$queryRaw<{ value: number | bigint }[]>`SELECT value FROM sequences WHERE name = ${name}`;
  return Number(rows[0].value);
}

const currentYear = () => new Date().getUTCFullYear();

/** Must run before any transaction that may create a student (see ensureSequence). */
export async function ensureStudentCodeSequence(year = currentYear()) {
  await ensureSequence(`studentCode:${year}`, async () => {
    const codes = await db.studentProfile.findMany({
      where: { studentCode: { startsWith: studentCodePrefix(year) } },
      select: { studentCode: true },
    });
    return highestSequence(codes.map((c) => c.studentCode), year);
  });
}

/** Allocates the next free student code for the year, e.g. S2026-014. */
export async function generateStudentCode(tx: Tx, year = currentYear()): Promise<string> {
  const name = `studentCode:${year}`;
  // Skip numbers someone already typed in by hand.
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = formatStudentCode(year, await nextSequenceValue(tx, name));
    if (!(await tx.studentProfile.findUnique({ where: { studentCode: code }, select: { userId: true } }))) return code;
  }
  throw new Error("Could not allocate a student code.");
}

/** Creates the profile rows a role needs (student record, teacher profile). Existing rows are kept. */
export async function ensureRoleProfiles(tx: Tx, userId: string, roles: Role[]) {
  if (roles.includes("STUDENT")) {
    const has = await tx.studentProfile.findUnique({ where: { userId }, select: { userId: true } });
    if (!has) {
      await tx.studentProfile.create({ data: { userId, studentCode: await generateStudentCode(tx) } });
    }
  }
  if (roles.includes("TEACHER") || roles.includes("ASSISTANT")) {
    await tx.teacherProfile.upsert({ where: { userId }, create: { userId }, update: {} });
  }
}

export async function setUserRoles(tx: Tx, userId: string, roles: Role[]) {
  await tx.userRole.deleteMany({ where: { userId, role: { notIn: roles } } });
  await tx.userRole.createMany({ data: roles.map((role) => ({ userId, role })), skipDuplicates: true });
  await ensureRoleProfiles(tx, userId, roles);
}

/** Creates an INVITED account (no password yet). */
export async function createInvitedUser(
  tx: Tx,
  input: { name: string; email: string; phone?: string | null; roles: Role[] },
) {
  await assertEmailAvailable(tx, input.email);
  const user = await tx.user.create({
    data: {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      status: "INVITED",
    },
  });
  await setUserRoles(tx, user.id, input.roles);
  return user;
}

export type InviteResult = { url: string; delivered: boolean };

/** Issues an invite link and emails it. Call after the creating transaction commits. */
export async function sendInvite(user: { id: string; name: string; email: string }): Promise<InviteResult> {
  const link = await issueAccountToken(user.id, "invite");
  const { institutionName } = await getSettings("general");
  const { delivered } = await sendAccountEmail(user, "invite", link, institutionName);
  return { url: link.url, delivered };
}

export async function sendPasswordResetLink(user: { id: string; name: string; email: string }): Promise<InviteResult> {
  const link = await issueAccountToken(user.id, "reset");
  const { institutionName } = await getSettings("general");
  const { delivered } = await sendAccountEmail(user, "reset", link, institutionName);
  return { url: link.url, delivered };
}

export async function revokeSessions(userId: string, tx: Tx = db) {
  await tx.session.deleteMany({ where: { userId } });
}

export async function countActiveAdmins(tx: Tx = db) {
  return tx.userRole.count({ where: { role: "ADMIN", user: { status: "ACTIVE", deletedAt: null } } });
}
