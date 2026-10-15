import { describe, expect, it } from "vitest";
import { aggregateScore, attemptDeadline, canSeeResults, passed, quizSettingsSchema, resolveItems, startRefusal } from "./quiz";

const settings = (over: Partial<ReturnType<typeof quizSettingsSchema.parse>> = {}) => ({ ...quizSettingsSchema.parse({}), ...over });
const bank = [
  { id: "q1", tags: ["easy"], points: 1 },
  { id: "q2", tags: ["easy"], points: 1 },
  { id: "q3", tags: ["easy", "hard"], points: 2 },
  { id: "q4", tags: ["hard"], points: 3 },
];

describe("resolveItems", () => {
  it("keeps fixed questions and point overrides", () => {
    const { items, missing } = resolveItems(
      [
        { kind: "question", questionId: "q4", points: null },
        { kind: "question", questionId: "q1", points: 5 },
      ],
      bank,
      "s",
      false,
    );
    expect(items).toEqual([
      { questionId: "q4", points: 3 },
      { questionId: "q1", points: 5 },
    ]);
    expect(missing).toEqual([]);
  });

  it("draws random questions by tag without repeating fixed ones", () => {
    const { items } = resolveItems(
      [
        { kind: "question", questionId: "q3", points: null },
        { kind: "random", tag: "easy", count: 2, points: null },
      ],
      bank,
      "seed",
      false,
    );
    expect(items).toHaveLength(3);
    expect(new Set(items.map((i) => i.questionId)).size).toBe(3);
    expect(items.slice(1).every((i) => ["q1", "q2"].includes(i.questionId))).toBe(true);
  });

  it("is deterministic per seed and reports shortfalls", () => {
    const rule = [{ kind: "random" as const, tag: "easy", count: 5, points: 2 }];
    const a = resolveItems(rule, bank, "attempt-1", false);
    expect(a).toEqual(resolveItems(rule, bank, "attempt-1", false));
    expect(a.items.every((i) => i.points === 2)).toBe(true);
    expect(a.missing).toEqual(["Item 1: only 3 of 5 questions tagged “easy”"]);
    expect(resolveItems([{ kind: "question", questionId: "gone", points: null }], bank, "s", false).missing).toHaveLength(1);
  });
});

describe("attempt rules", () => {
  const start = new Date("2026-10-12T10:00:00Z");
  const due = new Date("2026-10-12T10:20:00Z");

  it("computes deadlines from the time limit and the due date", () => {
    expect(attemptDeadline(start, settings(), due)).toBeNull();
    expect(attemptDeadline(start, settings({ timeLimitMin: 30 }), due)?.toISOString()).toBe("2026-10-12T10:30:00.000Z");
    expect(attemptDeadline(start, settings({ timeLimitMin: 30, lockAfterDue: true }), due)?.toISOString()).toBe(due.toISOString());
    expect(attemptDeadline(start, settings({ lockAfterDue: true }), null)).toBeNull();
  });

  it("limits attempts and closed quizzes", () => {
    const base = { attemptsUsed: 0, dueAt: due, now: start, questionCount: 3 };
    expect(startRefusal({ ...base, settings: settings() })).toBeNull();
    expect(startRefusal({ ...base, attemptsUsed: 1, settings: settings() })).toMatch(/already taken/);
    expect(startRefusal({ ...base, attemptsUsed: 3, settings: settings({ maxAttempts: 3 }) })).toMatch(/all 3 attempts/);
    expect(startRefusal({ ...base, attemptsUsed: 99, settings: settings({ maxAttempts: 0 }) })).toBeNull();
    expect(startRefusal({ ...base, now: due, settings: settings({ lockAfterDue: true }) })).toMatch(/closed/);
    expect(startRefusal({ ...base, now: due, settings: settings() })).toBeNull();
    expect(startRefusal({ ...base, questionCount: 0, settings: settings() })).toMatch(/no questions/);
  });

  it("aggregates scores by policy", () => {
    expect(aggregateScore([], "highest")).toBeNull();
    expect(aggregateScore([4, 9, 6], "highest")).toBe(9);
    expect(aggregateScore([4, 9, 6], "last")).toBe(6);
    expect(aggregateScore([4, 9, 6.5], "average")).toBe(6.5);
  });

  it("decides when results are visible and whether the student passed", () => {
    expect(canSeeResults(settings(), due, start)).toBe(true);
    expect(canSeeResults(settings({ showResults: "never" }), due, start)).toBe(false);
    expect(canSeeResults(settings({ showResults: "after_due" }), due, start)).toBe(false);
    expect(canSeeResults(settings({ showResults: "after_due" }), due, due)).toBe(true);
    expect(passed(7, 10, settings({ passingPercent: 70 }))).toBe(true);
    expect(passed(6.9, 10, settings({ passingPercent: 70 }))).toBe(false);
    expect(passed(5, 10, settings())).toBeNull();
  });
});
