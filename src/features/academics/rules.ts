/** Pure academic rules: slugs, class access and enrollment eligibility. No DB or Next.js imports. */
import type { Role } from "@/lib/auth/permissions";

export type ClassRole = "TEACHER" | "ASSISTANT" | "STUDENT";
export type MembershipStatus = "ACTIVE" | "WITHDRAWN" | "COMPLETED";
export type ClassStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "item"
  );
}

/** Picks `base`, or `base-2`, `base-3`… avoiding taken slugs. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type ClassAccess = {
  /** Can open the class at all. */
  canView: boolean;
  /** Teacher, assistant, or admin: sees the roster, grades, attendance. */
  isStaff: boolean;
  /** Teacher or admin (assistants can't edit content or delete). */
  isTeacher: boolean;
  /** Active student of the class. */
  isStudent: boolean;
};

/**
 * What a user can do in a class, from their global roles and their membership row (if any).
 * Students of COMPLETED classes keep read access; DRAFT/ARCHIVED classes are staff-only.
 */
export function classAccess(input: {
  roles: readonly Role[];
  membership: { role: ClassRole; status: MembershipStatus } | null;
  classStatus: ClassStatus;
}): ClassAccess {
  const { roles, membership, classStatus } = input;
  const admin = roles.includes("ADMIN");
  const activeStaff =
    membership?.status === "ACTIVE" && (membership.role === "TEACHER" || membership.role === "ASSISTANT");
  const isTeacher = admin || (activeStaff && membership.role === "TEACHER");
  const isStaff = admin || activeStaff;

  const studentVisible = classStatus === "ACTIVE" || classStatus === "COMPLETED";
  const isStudent =
    membership?.role === "STUDENT" &&
    studentVisible &&
    (membership.status === "ACTIVE" || membership.status === "COMPLETED");

  return { canView: isStaff || isStudent, isStaff, isTeacher, isStudent };
}

export const ENROLLABLE_CLASS_STATUSES: readonly ClassStatus[] = ["DRAFT", "ACTIVE"];

/** Office enrollment check. Returns a refusal or null. */
export function enrollmentRefusal(input: {
  classStatus: ClassStatus;
  capacity: number | null;
  activeStudents: number;
  adding: number;
}): string | null {
  if (!ENROLLABLE_CLASS_STATUSES.includes(input.classStatus)) {
    return "This class is closed for enrollment.";
  }
  if (input.capacity !== null && input.activeStudents + input.adding > input.capacity) {
    const left = Math.max(0, input.capacity - input.activeStudents);
    return `Not enough seats: ${left} of ${input.capacity} left.`;
  }
  return null;
}

/** Catalog self-enrollment check for a signed-in student. Returns a refusal or null. */
export function selfEnrollRefusal(input: {
  courseStatus: CourseStatus;
  selfEnroll: boolean;
  classStatus: ClassStatus;
  capacity: number | null;
  activeStudents: number;
  existing: { status: MembershipStatus } | null;
}): string | null {
  if (input.courseStatus !== "PUBLISHED" || !input.selfEnroll) return "This course doesn't accept self-enrollment.";
  if (input.classStatus !== "ACTIVE") return "This class isn't open for enrollment.";
  if (input.existing?.status === "ACTIVE") return "You're already enrolled in this class.";
  if (input.existing?.status === "COMPLETED") return "You already completed this class.";
  if (input.capacity !== null && input.activeStudents >= input.capacity) return "This class is full.";
  return null;
}

/** Which global roles may hold a class role. */
export function canHoldClassRole(roles: readonly Role[], classRole: ClassRole): boolean {
  if (classRole === "TEACHER") return roles.includes("TEACHER");
  if (classRole === "ASSISTANT") return roles.includes("TEACHER") || roles.includes("ASSISTANT");
  return roles.includes("STUDENT");
}
