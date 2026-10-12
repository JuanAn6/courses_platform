/** Concurrency check: many simultaneous enrollments into a 3-seat class must never exceed capacity. */
import { db } from "@/lib/db";
import { enrollInLockedClass, lockClasses } from "@/features/academics/enrollment-service";

const CAPACITY = 3;
const course = await db.course.findFirstOrThrow({ select: { id: true } });
const students = await db.user.findMany({
  where: { roles: { some: { role: "STUDENT" } }, studentProfile: { is: { status: "ACTIVE" } }, deletedAt: null },
  take: 10,
  select: { id: true },
});
const klass = await db.class.create({
  data: { courseId: course.id, name: "Capacity check", code: `CAP-CHECK-${Date.now()}`, status: "ACTIVE", capacity: CAPACITY },
});

try {
  const results = await Promise.allSettled(
    students.map((s) =>
      db.$transaction(
        async (tx) => {
          await lockClasses(tx, [klass.id]);
          return enrollInLockedClass(tx, klass.id, [s.id]);
        },
        { timeout: 30_000, maxWait: 30_000 },
      ),
    ),
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const refused = results.filter((r) => r.status === "rejected" && String(r.reason).includes("Not enough seats")).length;
  const enrolled = await db.classMember.count({ where: { classId: klass.id, status: "ACTIVE" } });
  console.log(`${students.length} concurrent attempts: ${ok} enrolled, ${refused} refused (full), ${enrolled} active in DB`);
  const pass = enrolled === CAPACITY && ok === CAPACITY && refused === students.length - CAPACITY;
  console.log(pass ? "OK: capacity respected" : "FAIL");
  process.exitCode = pass ? 0 : 1;
} finally {
  await db.class.delete({ where: { id: klass.id } });
  await db.$disconnect();
}
