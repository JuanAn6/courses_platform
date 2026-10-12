import { describe, expect, it } from "vitest";
import { utcToZonedInput, zonedInputToUtc } from "./timezone";

describe("zonedInputToUtc", () => {
  it("handles UTC and fixed-offset zones", () => {
    expect(zonedInputToUtc("2026-03-10T14:30", "UTC")?.toISOString()).toBe("2026-03-10T14:30:00.000Z");
    // Bogotá is UTC-5 all year.
    expect(zonedInputToUtc("2026-03-10T14:30", "America/Bogota")?.toISOString()).toBe("2026-03-10T19:30:00.000Z");
    expect(zonedInputToUtc("2026-03-10T08:00", "Asia/Kolkata")?.toISOString()).toBe("2026-03-10T02:30:00.000Z");
  });

  it("respects daylight saving time", () => {
    // Madrid: CET (UTC+1) in January, CEST (UTC+2) in July.
    expect(zonedInputToUtc("2026-01-15T09:00", "Europe/Madrid")?.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedInputToUtc("2026-07-15T09:00", "Europe/Madrid")?.toISOString()).toBe("2026-07-15T07:00:00.000Z");
    // New York, the day DST starts (2026-03-08): 10:00 is EDT (UTC-4).
    expect(zonedInputToUtc("2026-03-08T10:00", "America/New_York")?.toISOString()).toBe("2026-03-08T14:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(zonedInputToUtc("", "UTC")).toBeNull();
    expect(zonedInputToUtc("2026-03-10 14:30", "UTC")).toBeNull();
  });
});

describe("utcToZonedInput", () => {
  it("formats wall-clock time in the zone and round-trips", () => {
    const d = new Date("2026-07-15T07:00:00Z");
    expect(utcToZonedInput(d, "Europe/Madrid")).toBe("2026-07-15T09:00");
    expect(utcToZonedInput(d, "UTC")).toBe("2026-07-15T07:00");
    for (const tz of ["America/Bogota", "Europe/Madrid", "Asia/Tokyo", "America/New_York"]) {
      expect(zonedInputToUtc(utcToZonedInput(d, tz), tz)?.getTime()).toBe(d.getTime());
    }
    expect(utcToZonedInput(null, "UTC")).toBe("");
  });
});
