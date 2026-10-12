import "server-only";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** Whether the user may edit a unit's content: admins, course editors, or teachers of the owning class. */
export async function canEditUnit(user: CurrentUser, unit: { courseId: string; classId: string | null }) {
  if (user.roles.includes("ADMIN")) return true;
  if (unit.classId) {
    const m = await db.classMember.findUnique({
      where: { classId_userId: { classId: unit.classId, userId: user.id } },
      select: { role: true, status: true },
    });
    return m?.role === "TEACHER" && m.status === "ACTIVE";
  }
  return !!(await db.courseEditor.findUnique({ where: { courseId_userId: { courseId: unit.courseId, userId: user.id } } }));
}

/**
 * Whether the user may see an entry's content (used for file downloads).
 * Staff: admins, course editors, staff of a class that includes the entry.
 * Students: members of such a class, if the entry is published, not hidden and released.
 * (Unit prerequisites are enforced by the player, not here.)
 */
export async function canViewEntryContent(user: CurrentUser, entryId: string, now = new Date()): Promise<boolean> {
  if (user.roles.includes("ADMIN")) return true;
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: { unit: true },
  });
  if (!entry || entry.deletedAt || entry.unit.deletedAt) return false;
  if (await canEditUnit(user, entry.unit)) return true;

  const memberships = await db.classMember.findMany({
    where: {
      userId: user.id,
      class: entry.unit.classId ? { id: entry.unit.classId } : { courseId: entry.unit.courseId },
    },
    include: { class: { select: { id: true, status: true } } },
  });
  for (const m of memberships) {
    if (m.role !== "STUDENT" && m.status === "ACTIVE") return true; // class staff
    if (m.role !== "STUDENT") continue;
    if (!["ACTIVE", "COMPLETED"].includes(m.status) || !["ACTIVE", "COMPLETED"].includes(m.class.status)) continue;
    if (entry.status !== "PUBLISHED") continue;
    const [entryOverride, unitOverride] = await Promise.all([
      db.entryClassOverride.findUnique({ where: { entryId_classId: { entryId, classId: m.classId } } }),
      db.unitClassOverride.findUnique({ where: { unitId_classId: { unitId: entry.unitId, classId: m.classId } } }),
    ]);
    if (entryOverride?.hidden || unitOverride?.hidden) continue;
    const releases = [unitOverride?.releaseAt ?? entry.unit.releaseAt, entryOverride?.releaseAt ?? entry.releaseAt];
    if (releases.some((d) => d && d > now)) continue;
    return true;
  }
  return false;
}
