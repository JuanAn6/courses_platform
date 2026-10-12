import { describe, expect, it } from "vitest";
import { buildOutline, findEntry, neighbors, type OutlineEntryInput, type OutlineUnitInput } from "./outline";

const now = new Date("2026-10-12T12:00:00Z");
const past = new Date("2026-10-01T00:00:00Z");
const future = new Date("2026-11-01T00:00:00Z");

const entry = (id: string, extra: Partial<OutlineEntryInput> = {}): OutlineEntryInput => ({
  id,
  type: "TEXT",
  title: id,
  position: 0,
  status: "PUBLISHED",
  required: true,
  releaseAt: null,
  dueAt: null,
  ...extra,
});
const unit = (id: string, entries: OutlineEntryInput[], extra: Partial<OutlineUnitInput> = {}): OutlineUnitInput => ({
  id,
  title: id,
  description: null,
  position: 0,
  classId: null,
  releaseAt: null,
  prerequisiteUnitId: null,
  entries,
  ...extra,
});
const done = { status: "COMPLETED" as const, percent: 100 };

describe("buildOutline", () => {
  it("hides drafts and hidden overrides from students but not staff", () => {
    const units = [
      unit("u1", [
        entry("e1"),
        entry("draft", { status: "DRAFT", position: 1 }),
        entry("hidden", { position: 2, override: { hidden: true, releaseAt: null } }),
      ]),
    ];
    const student = buildOutline({ units, now, viewer: "student" });
    expect(student.units[0].entries.map((e) => e.id)).toEqual(["e1"]);
    const staff = buildOutline({ units, now, viewer: "staff" });
    expect(staff.units[0].entries.map((e) => [e.id, e.hidden])).toEqual([
      ["e1", false],
      ["draft", true],
      ["hidden", true],
    ]);
  });

  it("drops hidden or empty units for students", () => {
    const units = [unit("hiddenUnit", [entry("a")], { override: { hidden: true, releaseAt: null } }), unit("empty", [], { position: 1 })];
    expect(buildOutline({ units, now, viewer: "student" }).units).toEqual([]);
    expect(buildOutline({ units, now, viewer: "staff" }).units).toHaveLength(2);
  });

  it("locks by release date, with class overrides taking precedence", () => {
    const units = [
      unit("u1", [
        entry("soon", { releaseAt: future }),
        entry("overriddenOpen", { position: 1, releaseAt: future, override: { hidden: false, releaseAt: past } }),
        entry("overriddenLater", { position: 2, override: { hidden: false, releaseAt: future } }),
      ]),
    ];
    const o = buildOutline({ units, now, viewer: "student" });
    expect(o.units[0].entries.map((e) => [e.id, e.locked])).toEqual([
      ["soon", true],
      ["overriddenOpen", false],
      ["overriddenLater", true],
    ]);
    expect(o.units[0].entries[0].lockReason).toBe("release");
  });

  it("locks a whole unit until its release date", () => {
    const o = buildOutline({ units: [unit("u1", [entry("a")], { releaseAt: future })], now, viewer: "student" });
    expect(o.units[0]).toMatchObject({ locked: true, lockReason: "release" });
    expect(o.units[0].entries[0].locked).toBe(true);
    expect(o.nextEntryId).toBeNull();
  });

  it("locks units until their prerequisite's required entries are completed", () => {
    const build = (progress: OutlineEntryInput["progress"]) =>
      buildOutline({
        units: [
          unit("intro", [entry("i1", { progress }), entry("optional", { position: 1, required: false })]),
          unit("next", [entry("n1")], { position: 1, prerequisiteUnitId: "intro" }),
        ],
        now,
        viewer: "student",
      });
    expect(build(null).units[1]).toMatchObject({ locked: true, lockReason: "prerequisite", prerequisiteTitle: "intro" });
    expect(build(done).units[1].locked).toBe(false);
  });

  it("computes required progress, overdue items and the next entry", () => {
    const o = buildOutline({
      units: [
        unit("u1", [
          entry("a", { progress: done }),
          entry("b", { position: 1, dueAt: past, progress: { status: "IN_PROGRESS", percent: 40 } }),
          entry("c", { position: 2, required: false }),
        ]),
        unit("classUnit", [entry("d")], { classId: "k1", position: -5 }),
      ],
      now,
      viewer: "student",
    });
    expect(o.units.map((u) => u.id)).toEqual(["u1", "classUnit"]); // class units come after course units
    expect([o.requiredDone, o.requiredTotal, o.percent]).toEqual([1, 3, 33]);
    expect(o.units[0].entries[1]).toMatchObject({ overdue: true, percent: 40, completed: false });
    expect(o.nextEntryId).toBe("b");
  });

  it("has no percentage when nothing is required", () => {
    expect(buildOutline({ units: [unit("u", [entry("a", { required: false })])], now, viewer: "student" }).percent).toBeNull();
  });

  it("finds entries and their neighbors across units", () => {
    const o = buildOutline({
      units: [unit("u1", [entry("a"), entry("b", { position: 1 })]), unit("u2", [entry("c")], { position: 1 })],
      now,
      viewer: "student",
    });
    expect(findEntry(o, "c")?.unit.id).toBe("u2");
    expect(findEntry(o, "zzz")).toBeNull();
    expect(neighbors(o, "b")).toMatchObject({ previous: { id: "a" }, next: { id: "c" } });
    expect(neighbors(o, "a").previous).toBeNull();
  });
});
