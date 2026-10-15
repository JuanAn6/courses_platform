import { describe, expect, it } from "vitest";
import { normalizeTags, parseTags, serializeTags } from "./tags";

describe("question tags", () => {
  it("normalizes, dedupes and limits", () => {
    expect(normalizeTags("Fractions, ecuaciones lineales; FRACTIONS,, ")).toEqual(["fractions", "ecuaciones-lineales"]);
    expect(normalizeTags(Array.from({ length: 15 }, (_, i) => `t${i}`))).toHaveLength(10);
    expect(normalizeTags("!!!")).toEqual([]);
  });

  it("round-trips the stored format", () => {
    expect(serializeTags(["a", "b-c"])).toBe(",a,b-c,");
    expect(serializeTags([])).toBe("");
    expect(parseTags(",a,b-c,")).toEqual(["a", "b-c"]);
    expect(parseTags("")).toEqual([]);
  });
});
