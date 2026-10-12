/**
 * Demo data for local development: one account per role, 10 students and a guardian.
 * Idempotent: safe to run repeatedly (`npm run db:seed`). All accounts share SEED_PASSWORD.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Role } from "../src/generated/prisma/client";
import { parseDatabaseUrl } from "../src/lib/db-url";

const PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

const db = new PrismaClient({ adapter: new PrismaMariaDb(parseDatabaseUrl(process.env.DATABASE_URL!)) });

type SeedUser = { email: string; name: string; roles: Role[] };

const STAFF: SeedUser[] = [
  { email: "admin@school.test", name: "Ada Admin", roles: ["ADMIN"] },
  { email: "secretary@school.test", name: "Sam Secretary", roles: ["SECRETARY"] },
  { email: "teacher1@school.test", name: "Tomás Teacher", roles: ["TEACHER"] },
  { email: "teacher2@school.test", name: "Tina Teacher", roles: ["TEACHER"] },
  { email: "assistant@school.test", name: "Alex Assistant", roles: ["ASSISTANT"] },
  { email: "guardian@school.test", name: "Grace Guardian", roles: ["GUARDIAN"] },
];

const STUDENT_NAMES = [
  "Liam Torres", "Emma García", "Noah Smith", "Olivia Martínez", "Lucas Brown",
  "Sofía López", "Mateo Johnson", "Valentina Díaz", "Ethan Wilson", "Isabella Moreno",
];

async function upsertUser(u: SeedUser, passwordHash: string) {
  const user = await db.user.upsert({
    where: { email: u.email },
    create: { id: randomUUID(), email: u.email, name: u.name, emailVerified: true, status: "ACTIVE" },
    update: { name: u.name, status: "ACTIVE", deletedAt: null },
  });

  await db.userRole.deleteMany({ where: { userId: user.id, role: { notIn: u.roles } } });
  for (const role of u.roles) {
    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      create: { userId: user.id, role },
      update: {},
    });
  }

  // Better Auth stores email/password credentials in `accounts` with providerId "credential".
  const account = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (account) {
    await db.account.update({ where: { id: account.id }, data: { password: passwordHash } });
  } else {
    await db.account.create({
      data: { id: randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash },
    });
  }
  return user;
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  await db.setting.upsert({
    where: { key: "general" },
    create: { key: "general", value: { institutionName: "Demo Academy", contactEmail: "office@school.test", timezone: "UTC" } },
    update: {},
  });

  const staff = new Map<string, string>();
  for (const u of STAFF) {
    const user = await upsertUser(u, passwordHash);
    staff.set(u.email, user.id);
  }

  for (const id of [staff.get("teacher1@school.test")!, staff.get("teacher2@school.test")!]) {
    await db.teacherProfile.upsert({ where: { userId: id }, create: { userId: id }, update: {} });
  }

  const studentIds: string[] = [];
  for (const [i, name] of STUDENT_NAMES.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const user = await upsertUser({ email: `student${n}@school.test`, name, roles: ["STUDENT"] }, passwordHash);
    await db.studentProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, studentCode: `S2026-0${n}`, status: "ACTIVE" },
      update: {},
    });
    studentIds.push(user.id);
  }

  const guardianId = staff.get("guardian@school.test")!;
  for (const studentId of studentIds.slice(0, 2)) {
    await db.guardianLink.upsert({
      where: { guardianId_studentId: { guardianId, studentId } },
      create: { guardianId, studentId, relationship: "Parent" },
      update: {},
    });
  }

  await db.auditLog.create({
    data: { action: "seed.run", entityType: "System", diff: { users: STAFF.length + STUDENT_NAMES.length } },
  });

  console.log(`Seeded ${STAFF.length} staff/guardian accounts and ${STUDENT_NAMES.length} students.`);
  console.log(`Sign in with e.g. admin@school.test / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
