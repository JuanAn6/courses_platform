import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Account tokens look like `<userId>.<secret>`; only sha256(secret) is stored. */
export const TOKEN_PURPOSES = ["invite", "reset"] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

export const TOKEN_TTL_HOURS: Record<TokenPurpose, number> = {
  invite: 24 * 7,
  reset: 2,
};

export function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function formatToken(userId: string, secret: string): string {
  return `${userId}.${secret}`;
}

export function parseToken(token: string): { userId: string; secret: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const userId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!/^[\w-]{1,64}$/.test(userId) || !/^[\w-]{20,100}$/.test(secret)) return null;
  return { userId, secret };
}

export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function tokenIdentifier(purpose: TokenPurpose, userId: string): string {
  return `${purpose}:${userId}`;
}
