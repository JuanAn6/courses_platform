import { describe, expect, it } from "vitest";
import { formatToken, generateSecret, hashSecret, parseToken, secretMatches, tokenIdentifier } from "./token-format";

describe("account tokens", () => {
  it("round-trips userId and secret", () => {
    const secret = generateSecret();
    const userId = "3f2b8c1e-1a2b-4c3d-9e8f-0a1b2c3d4e5f";
    expect(parseToken(formatToken(userId, secret))).toEqual({ userId, secret });
  });

  it("generates long, unique, URL-safe secrets", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[\w-]{43}$/);
  });

  it.each(["", "nodot", ".secretonly", "user.", "user.short", "bad id.aaaaaaaaaaaaaaaaaaaaaaaa", "u.aaaaaaaaaaaaaaaaaaaaaaa/../x"])(
    "rejects malformed token %j",
    (token) => {
      expect(parseToken(token)).toBeNull();
    },
  );

  it("stores only a hash and compares in constant time", () => {
    const secret = generateSecret();
    const stored = hashSecret(secret);
    expect(stored).not.toContain(secret);
    expect(secretMatches(secret, stored)).toBe(true);
    expect(secretMatches(generateSecret(), stored)).toBe(false);
    expect(secretMatches(secret, "abc")).toBe(false);
  });

  it("namespaces identifiers by purpose", () => {
    expect(tokenIdentifier("invite", "u1")).toBe("invite:u1");
    expect(tokenIdentifier("reset", "u1")).toBe("reset:u1");
  });
});
