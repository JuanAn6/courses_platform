/** Concurrency check: five simultaneous "start quiz" calls must create exactly one attempt. */
import { db } from "@/lib/db";
import { startAttempt } from "@/features/assessment/quiz-service";

const entry = await db.entry.findFirstOrThrow({ where: { type: "QUIZ", title: "Unit 1 quiz" }, select: { id: true } });
const klass = await db.class.findFirstOrThrow({ where: { code: "MATH-101-26F-A" }, select: { id: true } });
const user = await db.user.findFirstOrThrow({ where: { email: "student10@school.test" }, select: { id: true } });
await db.quizAttempt.deleteMany({ where: { entryId: entry.id, userId: user.id } });

const ids = await Promise.all(
  Array.from({ length: 5 }, () => startAttempt({ entryId: entry.id, classId: klass.id, userId: user.id, dueAt: null })),
);
const rows = await db.quizAttempt.count({ where: { entryId: entry.id, userId: user.id } });
const pass = rows === 1 && new Set(ids).size === 1;
console.log(`returned ids: ${new Set(ids).size} distinct, attempts in DB: ${rows}`);
console.log(pass ? "OK: one attempt" : "FAIL");
await db.quizAttempt.deleteMany({ where: { entryId: entry.id, userId: user.id } });
await db.$disconnect();
process.exit(pass ? 0 : 1);
