/**
 * Role → permission map (docs/PLATFORM_SPEC.md §2).
 * Pure module: no DB or Next.js imports, so it is safe to use anywhere and easy to test.
 * Class-scoped checks (isClassStaff, isEnrolled…) are added with the class model in phase 3.
 */

export const ROLES = ["ADMIN", "SECRETARY", "TEACHER", "ASSISTANT", "STUDENT", "GUARDIAN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  SECRETARY: "Secretary",
  TEACHER: "Teacher",
  ASSISTANT: "Teaching assistant",
  STUDENT: "Student",
  GUARDIAN: "Guardian",
};

export const ROLE_PLURAL_LABELS: Record<Role, string> = {
  ADMIN: "Administrators",
  SECRETARY: "Secretaries",
  TEACHER: "Teachers",
  ASSISTANT: "Teaching assistants",
  STUDENT: "Students",
  GUARDIAN: "Guardians",
};

export const PERMISSIONS = {
  // Platform
  "settings.manage": ["ADMIN"],
  "auditLog.view": ["ADMIN"],
  "insights.view": ["ADMIN"],
  "users.manage": ["ADMIN"],
  "users.impersonate": ["ADMIN"],

  // People & administration
  "students.view": ["ADMIN", "SECRETARY"],
  "students.manage": ["ADMIN", "SECRETARY"],
  "students.viewSensitive": ["ADMIN", "SECRETARY"],
  "enrollments.manage": ["ADMIN", "SECRETARY"],
  "payments.manage": ["ADMIN", "SECRETARY"],
  "reports.view": ["ADMIN", "SECRETARY"],

  // Academic
  "courses.manage": ["ADMIN"],
  "classes.manage": ["ADMIN"],
  "certificates.manageTemplates": ["ADMIN"],

  // Board
  "board.postInstitution": ["ADMIN", "SECRETARY"],
  "board.moderateAll": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(roles: readonly Role[], ...wanted: Role[]): boolean {
  return wanted.some((r) => roles.includes(r));
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  const allowed: readonly Role[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}

/** Top-level app areas and who may enter them. ADMIN can enter every staff area. */
export const AREAS = {
  admin: { path: "/admin", label: "Administration", roles: ["ADMIN"] },
  office: { path: "/office", label: "Office", roles: ["ADMIN", "SECRETARY"] },
  teach: { path: "/teach", label: "Teaching", roles: ["ADMIN", "TEACHER", "ASSISTANT"] },
  learn: { path: "/learn", label: "Learning", roles: ["STUDENT"] },
  guardian: { path: "/guardian", label: "My students", roles: ["GUARDIAN"] },
} as const satisfies Record<string, { path: string; label: string; roles: readonly Role[] }>;

export type Area = keyof typeof AREAS;

export function canAccessArea(roles: readonly Role[], area: Area): boolean {
  const allowed: readonly Role[] = AREAS[area].roles;
  return roles.some((r) => allowed.includes(r));
}

/** Returns the area a URL path belongs to, or null for shared/public paths. */
export function areaForPath(pathname: string): Area | null {
  for (const [key, area] of Object.entries(AREAS) as [Area, (typeof AREAS)[Area]][]) {
    if (pathname === area.path || pathname.startsWith(`${area.path}/`)) return key;
  }
  return null;
}

/** Areas a user can open, in display order. */
export function accessibleAreas(roles: readonly Role[]): Area[] {
  return (Object.keys(AREAS) as Area[]).filter((a) => canAccessArea(roles, a));
}
