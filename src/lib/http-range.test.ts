import { describe, expect, it } from "vitest";
import { parseRange } from "./http-range";

describe("parseRange", () => {
  it("parses common forms", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("returns null without a header and invalid for unsatisfiable ranges", () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=50-10", 1000)).toBe("invalid");
    expect(parseRange("bytes=-", 1000)).toBe("invalid");
    expect(parseRange("bytes=0-1,5-6", 1000)).toBe("invalid");
    expect(parseRange("items=0-1", 1000)).toBe("invalid");
  });
});
