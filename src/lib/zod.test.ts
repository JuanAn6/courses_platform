import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkbox, formArray, optionalDate, optionalText, toDateInput } from "./zod";

describe("form zod helpers", () => {
  it("optionalText trims and maps empty to null", () => {
    const s = optionalText(5);
    expect(s.parse("  hi ")).toBe("hi");
    expect(s.parse("")).toBeNull();
    expect(s.parse(undefined)).toBeNull();
    expect(s.safeParse("toolong").success).toBe(false);
  });

  it("optionalDate parses ISO dates as UTC midnight", () => {
    const s = optionalDate();
    expect(s.parse("2024-02-29")).toEqual(new Date("2024-02-29T00:00:00Z"));
    expect(s.parse("")).toBeNull();
    expect(s.safeParse("29/02/2024").success).toBe(false);
    expect(s.safeParse("2023-02-29").success).toBe(false);
  });

  it("checkbox maps presence to booleans", () => {
    const s = checkbox();
    expect(s.parse("on")).toBe(true);
    expect(s.parse(undefined)).toBe(false);
    expect(s.parse("false")).toBe(false);
  });

  it("formArray accepts one or many values", () => {
    const s = formArray(z.enum(["A", "B"]));
    expect(s.parse("A")).toEqual(["A"]);
    expect(s.parse(["A", "B"])).toEqual(["A", "B"]);
    expect(s.parse(undefined)).toEqual([]);
    expect(s.safeParse(["C"]).success).toBe(false);
  });

  it("toDateInput formats for date inputs", () => {
    expect(toDateInput(new Date("2012-05-14T00:00:00Z"))).toBe("2012-05-14");
    expect(toDateInput(null)).toBe("");
  });
});
