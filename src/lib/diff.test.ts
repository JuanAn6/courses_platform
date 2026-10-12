import { describe, expect, it } from "vitest";
import { diffObjects } from "./diff";

describe("diffObjects", () => {
  it("returns only changed keys", () => {
    expect(diffObjects({ a: 1, b: "x", c: true }, { a: 1, b: "y", c: true })).toEqual({
      before: { b: "x" },
      after: { b: "y" },
    });
  });

  it("handles added and removed keys", () => {
    expect(diffObjects({ a: 1 }, { b: 2 })).toEqual({ before: { a: 1, b: null }, after: { a: null, b: 2 } });
  });

  it("returns empty objects when nothing changed", () => {
    expect(diffObjects({ a: [1, 2] }, { a: [1, 2] })).toEqual({ before: {}, after: {} });
  });
});
