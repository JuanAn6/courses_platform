import { accessibleAreas, AREAS, type Area, type Role } from "@/lib/auth/permissions";

/** Icon keys are resolved to lucide icons in the client nav (icons can't cross the RSC boundary). */
export type NavIcon =
  | "home"
  | "user"
  | "shield"
  | "settings"
  | "history"
  | "briefcase"
  | "graduation"
  | "book"
  | "users"
  | "user-cog"
  | "contact"
  | "upload";

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavSection = { title: string; items: NavItem[] };

const GENERAL: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/profile", label: "Profile", icon: "user" },
];

// Add pages here as each phase ships them.
const AREA_ITEMS: Record<Area, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Overview", icon: "shield" },
    { href: "/admin/users", label: "Users", icon: "user-cog" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
    { href: "/admin/audit-log", label: "Audit log", icon: "history" },
  ],
  office: [
    { href: "/office", label: "Overview", icon: "briefcase" },
    { href: "/office/students", label: "Students", icon: "contact" },
    { href: "/office/students/import", label: "Import students", icon: "upload" },
  ],
  teach: [{ href: "/teach", label: "Overview", icon: "graduation" }],
  learn: [{ href: "/learn", label: "My classes", icon: "book" }],
  guardian: [{ href: "/guardian", label: "My students", icon: "users" }],
};

export function navigationFor(roles: readonly Role[]): NavSection[] {
  return [
    { title: "General", items: GENERAL },
    ...accessibleAreas(roles).map((area) => ({ title: AREAS[area].label, items: AREA_ITEMS[area] })),
  ];
}
