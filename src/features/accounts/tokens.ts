import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/env";
import { db } from "@/lib/db";
import { sendMail, type MailResult } from "@/lib/mail";
import {
  formatToken,
  generateSecret,
  hashSecret,
  parseToken,
  secretMatches,
  tokenIdentifier,
  TOKEN_PURPOSES,
  TOKEN_TTL_HOURS,
  type TokenPurpose,
} from "./token-format";

export type IssuedToken = { url: string; expiresAt: Date };

/** Creates a single-use link, replacing any earlier link of the same purpose for that user. */
export async function issueAccountToken(
  userId: string,
  purpose: TokenPurpose,
  tx: Prisma.TransactionClient = db,
): Promise<IssuedToken> {
  const secret = generateSecret();
  const identifier = tokenIdentifier(purpose, userId);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS[purpose] * 3600_000);

  await tx.verification.deleteMany({ where: { identifier } });
  await tx.verification.create({
    data: { id: crypto.randomUUID(), identifier, value: hashSecret(secret), expiresAt },
  });

  return { url: `${env.APP_URL}/set-password/${formatToken(userId, secret)}`, expiresAt };
}

export type VerifiedToken = { userId: string; purpose: TokenPurpose; verificationId: string };

/** Validates a token without consuming it. */
export async function verifyAccountToken(token: string): Promise<VerifiedToken | null> {
  const parsed = parseToken(token);
  if (!parsed) return null;

  const rows = await db.verification.findMany({
    where: { identifier: { in: TOKEN_PURPOSES.map((p) => tokenIdentifier(p, parsed.userId)) } },
  });
  for (const row of rows) {
    if (row.expiresAt > new Date() && secretMatches(parsed.secret, row.value)) {
      const purpose = row.identifier.split(":")[0] as TokenPurpose;
      return { userId: parsed.userId, purpose, verificationId: row.id };
    }
  }
  return null;
}

export async function revokeAccountTokens(userId: string, tx: Prisma.TransactionClient = db) {
  await tx.verification.deleteMany({
    where: { identifier: { in: TOKEN_PURPOSES.map((p) => tokenIdentifier(p, userId)) } },
  });
}

export async function sendAccountEmail(
  to: { name: string; email: string },
  purpose: TokenPurpose,
  link: IssuedToken,
  institutionName: string,
): Promise<MailResult> {
  const expires = link.expiresAt.toUTCString();
  if (purpose === "invite") {
    return sendMail({
      to: to.email,
      subject: `You're invited to ${institutionName}`,
      text: `Hi ${to.name},\n\nAn account has been created for you at ${institutionName}.\nSet your password to get started:\n\n${link.url}\n\nThis link expires ${expires}.`,
    });
  }
  return sendMail({
    to: to.email,
    subject: `Reset your ${institutionName} password`,
    text: `Hi ${to.name},\n\nUse this link to choose a new password:\n\n${link.url}\n\nThis link expires ${expires}. If you didn't expect this email, you can ignore it.`,
  });
}
