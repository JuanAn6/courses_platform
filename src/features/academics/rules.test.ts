import { describe, expect, it } from "vitest";
import {
  canHoldClassRole,
  classAccess,
  enrollmentRefusal,
  selfEnrollRefusal,
  slugify,
  uniqueSlug,
} from "./rules";

describe("slugify", () => {
  it("makes readable ASCII slugs", () => {
    expect(slugify("Álgebra I: Ecuaciones & Funciones")).toBe("algebra-i-ecuaciones-funciones");
    expect(slugify("  --Hello   World--  ")).toBe("hello-world");
    expect(slugify("¿¡!?")).toBe("item");
    expect(slugify("a".repeat(100)).length).toBe(80);
  });

  it("finds a free slug", () => {
    expect(uniqueSlug("math", new Set())).toBe("math");
    expect(uniqueSlug("math", new Set(["math", "math-2"]))).toBe("math-3");
  });
});

describe("classAccess", () => {
  const active = (role: "TEACHER" | "ASSISTANT" | "STUDENT") => ({ role, status: "ACTIVE" as const });

  it("gives admins full staff access to any class", () => {
    expect(classAccess({ roles: ["ADMIN"], membership: null, classStatus: "DRAFT" })).toEqual({
      canView: true,
      isStaff: true,
      isTeacher: true,
      isStudent: false,
    });
  });

  it("distinguishes teachers from assistants", () => {
    const t = classAccess({ roles: ["TEACHER"], membership: active("TEACHER"), classStatus: "DRAFT" });
    expect(t).toMatchObject({ canView: true, isStaff: true, isTeacher: true });
    const a = classAccess({ roles: ["ASSISTANT"], membership: active("ASSISTANT"), classStatus: "ACTIVE" });
    expect(a).toMatchObject({ canView: true, isStaff: true, isTeacher: false });
  });

  it("drops staff access when the membership ended", () => {
    const t = classAccess({ roles: ["TEACHER"], membership: { role: "TEACHER", status: "WITHDRAWN" }, classStatus: "ACTIVE" });
    expect(t.canView).toBe(false);
  });

  it("lets students see active and completed classes only", () => {
    const s = (classStatus: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED", status: "ACTIVE" | "WITHDRAWN" | "COMPLETED" = "ACTIVE") =>
      classAccess({ roles: ["STUDENT"], membership: { role: "STUDENT", status }, classStatus }).canView;
    expect(s("ACTIVE")).toBe(true);
    expect(s("COMPLETED")).toBe(true);
    expect(s("COMPLETED", "COMPLETED")).toBe(true);
    expect(s("DRAFT")).toBe(false);
    expect(s("ARCHIVED")).toBe(false);
    expect(s("ACTIVE", "WITHDRAWN")).toBe(false);
  });

  it("denies outsiders", () => {
    expect(classAccess({ roles: ["TEACHER"], membership: null, classStatus: "ACTIVE" }).canView).toBe(false);
    expect(classAccess({ roles: ["SECRETARY"], membership: null, classStatus: "ACTIVE" }).canView).toBe(false);
  });
});

describe("enrollmentRefusal", () => {
  it("enforces status and capacity", () => {
    expect(enrollmentRefusal({ classStatus: "ACTIVE", capacity: null, activeStudents: 99, adding: 5 })).toBeNull();
    expect(enrollmentRefusal({ classStatus: "DRAFT", capacity: 10, activeStudents: 8, adding: 2 })).toBeNull();
    expect(enrollmentRefusal({ classStatus: "ACTIVE", capacity: 10, activeStudents: 8, adding: 3 })).toBe(
      "Not enough seats: 2 of 10 left.",
    );
    expect(enrollmentRefusal({ classStatus: "COMPLETED", capacity: null, activeStudents: 0, adding: 1 })).toMatch(/closed/);
  });
});

describe("selfEnrollRefusal", () => {
  const ok = {
    courseStatus: "PUBLISHED" as const,
    selfEnroll: true,
    classStatus: "ACTIVE" as const,
    capacity: 2,
    activeStudents: 1,
    existing: null,
  };

  it("allows open classes of self-enroll courses", () => {
    expect(selfEnrollRefusal(ok)).toBeNull();
    expect(selfEnrollRefusal({ ...ok, existing: { status: "WITHDRAWN" } })).toBeNull();
  });

  it("refuses closed, full, or already-joined classes", () => {
    expect(selfEnrollRefusal({ ...ok, selfEnroll: false })).toMatch(/self-enrollment/);
    expect(selfEnrollRefusal({ ...ok, courseStatus: "DRAFT" })).toMatch(/self-enrollment/);
    expect(selfEnrollRefusal({ ...ok, classStatus: "DRAFT" })).toMatch(/isn't open/);
    expect(selfEnrollRefusal({ ...ok, activeStudents: 2 })).toMatch(/full/);
    expect(selfEnrollRefusal({ ...ok, existing: { status: "ACTIVE" } })).toMatch(/already enrolled/);
  });
});

describe("canHoldClassRole", () => {
  it("matches class roles to global roles", () => {
    expect(canHoldClassRole(["TEACHER"], "TEACHER")).toBe(true);
    expect(canHoldClassRole(["TEACHER"], "ASSISTANT")).toBe(true);
    expect(canHoldClassRole(["ASSISTANT"], "TEACHER")).toBe(false);
    expect(canHoldClassRole(["STUDENT"], "STUDENT")).toBe(true);
    expect(canHoldClassRole(["GUARDIAN"], "STUDENT")).toBe(false);
  });
});
