import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps relative paths with query strings", () => {
    expect(safeRedirectPath("/admin/settings?tab=1")).toBe("/admin/settings?tab=1");
  });

  it.each([
    ["absolute URL", "https://evil.com"],
    ["protocol-relative URL", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["relative without slash", "admin"],
    ["javascript URL", "javascript:alert(1)"],
    ["control characters", "/a\nb"],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });

  it("falls back for non-strings and uses a custom fallback", () => {
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath(42, "/")).toBe("/");
  });
});
