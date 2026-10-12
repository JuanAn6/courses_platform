import { describe, expect, it } from "vitest";
import { checkAccountChange, isOfficeManageable } from "./rules";

const base = { actorId: "admin1", targetId: "user2", targetRoles: ["TEACHER" as const], activeAdminCount: 2 };

describe("checkAccountChange", () => {
  it("allows ordinary changes to other users", () => {
    expect(checkAccountChange({ ...base, change: { kind: "suspend" } })).toBeNull();
    expect(checkAccountChange({ ...base, change: { kind: "archive" } })).toBeNull();
    expect(checkAccountChange({ ...base, change: { kind: "roles", nextRoles: ["STUDENT"] } })).toBeNull();
  });

  it("prevents admins from locking themselves out", () => {
    const self = { ...base, targetId: "admin1", targetRoles: ["ADMIN" as const] };
    expect(checkAccountChange({ ...self, change: { kind: "suspend" } })).toMatch(/own account/);
    expect(checkAccountChange({ ...self, change: { kind: "archive" } })).toMatch(/own account/);
    expect(checkAccountChange({ ...self, change: { kind: "roles", nextRoles: ["TEACHER"] } })).toMatch(/own administrator/);
    expect(checkAccountChange({ ...self, change: { kind: "roles", nextRoles: ["ADMIN", "TEACHER"] } })).toBeNull();
  });

  it("keeps at least one active administrator", () => {
    const lastAdmin = { ...base, targetRoles: ["ADMIN" as const], activeAdminCount: 1 };
    expect(checkAccountChange({ ...lastAdmin, change: { kind: "suspend" } })).toMatch(/at least one/);
    expect(checkAccountChange({ ...lastAdmin, change: { kind: "roles", nextRoles: ["SECRETARY"] } })).toMatch(/at least one/);
    expect(checkAccountChange({ ...lastAdmin, activeAdminCount: 2, change: { kind: "suspend" } })).toBeNull();
  });
});

describe("isOfficeManageable", () => {
  it("only covers student and guardian accounts", () => {
    expect(isOfficeManageable(["STUDENT"])).toBe(true);
    expect(isOfficeManageable(["GUARDIAN", "STUDENT"])).toBe(true);
    expect(isOfficeManageable(["GUARDIAN", "TEACHER"])).toBe(false);
    expect(isOfficeManageable(["ADMIN"])).toBe(false);
    expect(isOfficeManageable([])).toBe(false);
  });
});
