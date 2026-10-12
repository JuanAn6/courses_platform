import type { Role } from "@/lib/auth/permissions";

/** Pure guard rules for account changes; returns a user-facing refusal or null. */

export type AccountChange =
  | { kind: "roles"; nextRoles: Role[] }
  | { kind: "suspend" }
  | { kind: "archive" };

export function checkAccountChange(input: {
  actorId: string;
  targetId: string;
  targetRoles: Role[];
  /** Active, non-archived admins right now (including the target if they are one). */
  activeAdminCount: number;
  change: AccountChange;
}): string | null {
  const { actorId, targetId, targetRoles, activeAdminCount, change } = input;
  const isSelf = actorId === targetId;
  const targetIsAdmin = targetRoles.includes("ADMIN");
  const removesAdmin =
    targetIsAdmin && (change.kind !== "roles" || !change.nextRoles.includes("ADMIN"));

  if (isSelf && change.kind === "suspend") return "You can't suspend your own account.";
  if (isSelf && change.kind === "archive") return "You can't archive your own account.";
  if (isSelf && removesAdmin) return "You can't remove your own administrator role.";
  if (removesAdmin && activeAdminCount <= 1) return "There must always be at least one active administrator.";
  return null;
}

/** Roles the office (secretary) may grant when creating or inviting accounts. */
export const OFFICE_MANAGED_ROLES: readonly Role[] = ["STUDENT", "GUARDIAN"];

export function isOfficeManageable(roles: readonly Role[]): boolean {
  return roles.length > 0 && roles.every((r) => OFFICE_MANAGED_ROLES.includes(r));
}
