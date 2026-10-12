import { describe, expect, it } from "vitest";
import { navigationFor } from "./navigation";

describe("navigationFor", () => {
  it("always includes the general section", () => {
    expect(navigationFor([])).toHaveLength(1);
    expect(navigationFor([])[0].title).toBe("General");
  });

  it("shows admins the admin, office and teaching sections", () => {
    expect(navigationFor(["ADMIN"]).map((s) => s.title)).toEqual([
      "General",
      "Administration",
      "Office",
      "Teaching",
    ]);
  });

  it("never shows a student staff links", () => {
    const hrefs = navigationFor(["STUDENT"]).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs.some((h) => h.startsWith("/admin") || h.startsWith("/office") || h.startsWith("/teach"))).toBe(false);
  });
});
