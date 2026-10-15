import { describe, expect, it } from "vitest";
import { rubricMax, rubricSchema, rubricScore } from "./rubric";

const rubric = rubricSchema.parse({
  criteria: [
    { id: "c1", title: "Content", levels: [{ id: "a", label: "Weak", points: 1 }, { id: "b", label: "Strong", points: 4 }] },
    { id: "c2", title: "Style", levels: [{ id: "x", label: "OK", points: 2 }, { id: "y", label: "Great", points: 3.5 }] },
  ],
});

describe("rubrics", () => {
  it("adds the best level of each criterion for the maximum", () => {
    expect(rubricMax(rubric)).toBe(7.5);
    expect(rubricMax({ criteria: [] })).toBe(0);
  });

  it("scores selections and flags incomplete grading", () => {
    expect(rubricScore(rubric, { c1: "b", c2: "y" })).toEqual({ score: 7.5, complete: true });
    expect(rubricScore(rubric, { c1: "a" })).toEqual({ score: 1, complete: false });
    expect(rubricScore(rubric, { c1: "zzz", c2: "x" })).toEqual({ score: 2, complete: false });
  });

  it("validates structure", () => {
    expect(rubricSchema.safeParse({ criteria: [{ id: "c", title: "T", levels: [] }] }).success).toBe(false);
    expect(rubricSchema.safeParse({ criteria: [{ id: "c", title: "", levels: [{ id: "l", label: "L", points: 1 }] }] }).success).toBe(false);
  });
});
