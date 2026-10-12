import { describe, expect, it } from "vitest";
import { formatStudentCode, highestSequence } from "./student-code";

describe("student codes", () => {
  it("formats with at least three digits", () => {
    expect(formatStudentCode(2026, 1)).toBe("S2026-001");
    expect(formatStudentCode(2026, 1000)).toBe("S2026-1000");
  });

  it("finds the highest sequence numerically", () => {
    expect(highestSequence([], 2026)).toBe(0);
    expect(highestSequence(["S2026-999", "S2026-1000", "S2026-010"], 2026)).toBe(1000);
  });

  it("ignores other years and custom codes", () => {
    expect(highestSequence(["S2025-120", "CUSTOM-7", "S2026-004"], 2026)).toBe(4);
  });
});
