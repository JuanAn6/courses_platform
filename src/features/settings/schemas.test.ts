import { describe, expect, it } from "vitest";
import { isValidTimeZone, parseSettings } from "./schemas";

describe("parseSettings", () => {
  it("returns defaults for a missing row", () => {
    expect(parseSettings("general", undefined)).toEqual({
      institutionName: "My Institution",
      contactEmail: "",
      timezone: "UTC",
    });
    expect(parseSettings("academic", null)).toEqual({ passingScore: 60 });
    expect(parseSettings("messaging", {})).toEqual({ allowStudentToStudent: false });
  });

  it("keeps valid fields and resets invalid ones", () => {
    expect(parseSettings("general", { institutionName: "Acme", timezone: "Mars/Olympus" })).toEqual({
      institutionName: "Acme",
      contactEmail: "",
      timezone: "UTC",
    });
  });

  it("coerces numeric strings and rejects out-of-range values", () => {
    expect(parseSettings("academic", { passingScore: "75" })).toEqual({ passingScore: 75 });
    expect(parseSettings("academic", { passingScore: 150 })).toEqual({ passingScore: 60 });
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("America/Bogota")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
