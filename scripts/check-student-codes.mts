/** Concurrency check: allocates student codes in parallel transactions and asserts they're unique. */
import { db } from "@/lib/db";
import { ensureStudentCodeSequence, generateStudentCode } from "@/features/accounts/service";

const N = 20;
// A year with no counter yet, so the first-use path races too.
const year = 2100 + Math.floor(Math.random() * 800);
const codes = await Promise.all(
  Array.from({ length: N }, async () => {
    await ensureStudentCodeSequence(year); // concurrent first use races here too
    return db.$transaction((tx) => generateStudentCode(tx, year), { timeout: 30_000, maxWait: 30_000 });
  }),
);
const unique = new Set(codes);
console.log(codes.sort().join(" "));
console.log(unique.size === N ? `OK: ${N} unique codes` : `FAIL: only ${unique.size} unique of ${N}`);
await db.$executeRaw`DELETE FROM sequences WHERE name = ${`studentCode:${year}`}`;
await db.$disconnect();
process.exit(unique.size === N ? 0 : 1);
