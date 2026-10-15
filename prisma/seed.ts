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
import { seedAssessments, seedContent } from "./seed-content";

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

  await seedAcademics(staff, studentIds);

  await db.auditLog.create({
    data: { action: "seed.run", entityType: "System", diff: { users: STAFF.length + STUDENT_NAMES.length } },
  });

  console.log(`Seeded ${STAFF.length} staff/guardian accounts, ${STUDENT_NAMES.length} students, 3 courses and 3 classes.`);
  console.log(`Sign in with e.g. admin@school.test / ${PASSWORD}`);
}

/** Categories, a term, three courses and three classes with staff and students. */
async function seedAcademics(staff: Map<string, string>, studentIds: string[]) {
  const category = async (slug: string, name: string) =>
    db.category.upsert({ where: { slug }, create: { slug, name }, update: { name } });
  const [math, languages, sciences] = await Promise.all([
    category("mathematics", "Mathematics"),
    category("languages", "Languages"),
    category("sciences", "Sciences"),
  ]);

  const term = await db.academicTerm.upsert({
    where: { name: "2026 Fall" },
    create: { name: "2026 Fall", startDate: new Date("2026-08-03"), endDate: new Date("2026-12-11") },
    update: {},
  });

  const course = async (data: {
    code: string;
    title: string;
    slug: string;
    summary: string;
    description: string;
    level: string;
    categoryId: string;
    status: "DRAFT" | "PUBLISHED";
    selfEnroll: boolean;
    editor: string;
  }) => {
    const { editor, ...fields } = data;
    const c = await db.course.upsert({ where: { code: data.code }, create: fields, update: fields });
    const userId = staff.get(editor)!;
    await db.courseEditor.upsert({
      where: { courseId_userId: { courseId: c.id, userId } },
      create: { courseId: c.id, userId },
      update: {},
    });
    return c;
  };

  const algebra = await course({
    code: "MATH-101",
    title: "Algebra I",
    slug: "algebra-i",
    summary: "Equations, functions and graphs: the foundations of algebra.",
    description:
      "Learn to solve linear equations and inequalities, work with functions, and read graphs.\n\nPrerequisites: arithmetic with fractions and negative numbers.",
    level: "Grade 8",
    categoryId: math.id,
    status: "PUBLISHED",
    selfEnroll: false,
    editor: "teacher1@school.test",
  });
  const spanish = await course({
    code: "LANG-110",
    title: "Spanish for Beginners",
    slug: "spanish-for-beginners",
    summary: "Everyday conversation, pronunciation and basic grammar.",
    description: "A friendly introduction to Spanish with weekly conversation practice.\n\nNo prior knowledge required.",
    level: "A1",
    categoryId: languages.id,
    status: "PUBLISHED",
    selfEnroll: true,
    editor: "teacher2@school.test",
  });
  await seedContent(db, { algebraId: algebra.id, spanishId: spanish.id, teacherId: staff.get("teacher1@school.test")! });
  await seedAssessments(db, { algebraId: algebra.id, teacherId: staff.get("teacher1@school.test")! });

  const biology = await course({
    code: "SCI-120",
    title: "Biology Basics",
    slug: "biology-basics",
    summary: "Cells, genetics and ecosystems.",
    description: "Still being prepared.",
    level: "Grade 9",
    categoryId: sciences.id,
    status: "DRAFT",
    selfEnroll: false,
    editor: "teacher2@school.test",
  });

  const klass = async (data: {
    code: string;
    name: string;
    courseId: string;
    status: "DRAFT" | "ACTIVE";
    capacity: number | null;
    members: { userId: string; role: "TEACHER" | "ASSISTANT" | "STUDENT" }[];
  }) => {
    const { members, ...fields } = data;
    const values = { ...fields, termId: term.id, startDate: term.startDate, endDate: term.endDate };
    const k = await db.class.upsert({ where: { code: data.code }, create: values, update: values });
    for (const m of members) {
      await db.classMember.upsert({
        where: { classId_userId: { classId: k.id, userId: m.userId } },
        create: { classId: k.id, ...m },
        update: { role: m.role, status: "ACTIVE", endedAt: null, note: null },
      });
    }
    return k;
  };
  const students = (from: number, to: number) =>
    studentIds.slice(from - 1, to).map((userId) => ({ userId, role: "STUDENT" as const }));

  await klass({
    code: "MATH-101-26F-A",
    name: "Algebra I · Group A",
    courseId: algebra.id,
    status: "ACTIVE",
    capacity: 25,
    members: [
      { userId: staff.get("teacher1@school.test")!, role: "TEACHER" },
      { userId: staff.get("assistant@school.test")!, role: "ASSISTANT" },
      ...students(1, 6),
    ],
  });
  await klass({
    code: "LANG-110-26F",
    name: "Spanish for Beginners · Fall",
    courseId: spanish.id,
    status: "ACTIVE",
    capacity: 20,
    members: [{ userId: staff.get("teacher2@school.test")!, role: "TEACHER" }, ...students(4, 8)],
  });
  await klass({
    code: "SCI-120-26F",
    name: "Biology · Fall",
    courseId: biology.id,
    status: "DRAFT",
    capacity: null,
    members: [{ userId: staff.get("teacher2@school.test")!, role: "TEACHER" }],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
