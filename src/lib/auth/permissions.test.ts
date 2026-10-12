import { describe, expect, it } from "vitest";
import {
  accessibleAreas,
  areaForPath,
  canAccessArea,
  hasPermission,
  hasRole,
  PERMISSIONS,
  ROLES,
  type Permission,
} from "./permissions";

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

describe("hasPermission", () => {
  it("grants admins every permission", () => {
    for (const p of ALL_PERMISSIONS) expect(hasPermission(["ADMIN"], p)).toBe(true);
  });

  it("lets secretaries manage students and payments but not settings or courses", () => {
    expect(hasPermission(["SECRETARY"], "students.manage")).toBe(true);
    expect(hasPermission(["SECRETARY"], "students.viewSensitive")).toBe(true);
    expect(hasPermission(["SECRETARY"], "payments.manage")).toBe(true);
    expect(hasPermission(["SECRETARY"], "settings.manage")).toBe(false);
    expect(hasPermission(["SECRETARY"], "courses.manage")).toBe(false);
  });

  it("keeps sensitive student data away from teachers, students and guardians", () => {
    for (const role of ["TEACHER", "ASSISTANT", "STUDENT", "GUARDIAN"] as const) {
      expect(hasPermission([role], "students.viewSensitive")).toBe(false);
    }
  });

  it("denies everything to a user without roles", () => {
    for (const p of ALL_PERMISSIONS) expect(hasPermission([], p)).toBe(false);
  });

  it("combines multiple roles", () => {
    expect(hasPermission(["STUDENT", "SECRETARY"], "students.manage")).toBe(true);
  });

  it("only references known roles", () => {
    for (const roles of Object.values(PERMISSIONS)) {
      for (const r of roles) expect(ROLES).toContain(r);
    }
  });
});

describe("areas", () => {
  it("maps paths to areas", () => {
    expect(areaForPath("/admin")).toBe("admin");
    expect(areaForPath("/admin/settings")).toBe("admin");
    expect(areaForPath("/office/students/1")).toBe("office");
    expect(areaForPath("/administration")).toBeNull();
    expect(areaForPath("/dashboard")).toBeNull();
  });

  it("lets admins into staff areas only", () => {
    expect(accessibleAreas(["ADMIN"])).toEqual(["admin", "office", "teach"]);
  });

  it("gives each role its own area", () => {
    expect(accessibleAreas(["SECRETARY"])).toEqual(["office"]);
    expect(accessibleAreas(["TEACHER"])).toEqual(["teach"]);
    expect(accessibleAreas(["ASSISTANT"])).toEqual(["teach"]);
    expect(accessibleAreas(["STUDENT"])).toEqual(["learn"]);
    expect(accessibleAreas(["GUARDIAN"])).toEqual(["guardian"]);
  });

  it("blocks students from staff areas", () => {
    expect(canAccessArea(["STUDENT"], "admin")).toBe(false);
    expect(canAccessArea(["STUDENT"], "office")).toBe(false);
    expect(canAccessArea(["STUDENT"], "teach")).toBe(false);
  });

  it("hasRole matches any of the wanted roles", () => {
    expect(hasRole(["TEACHER"], "ADMIN", "TEACHER")).toBe(true);
    expect(hasRole(["STUDENT"], "ADMIN", "TEACHER")).toBe(false);
  });
});
