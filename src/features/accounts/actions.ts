"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { command, ForbiddenError, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth/auth";
import { hasPermission, type Role } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isOfficeManageable } from "@/features/users/rules";
import { revokeSessions, sendInvite, sendPasswordResetLink, type InviteResult } from "./service";
import { revokeAccountTokens, verifyAccountToken } from "./tokens";

const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

/** Public: completes an invite or password reset from an emailed link, then signs the user in. */
export async function setPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const verified = await verifyAccountToken(parsed.data.token);
  if (!verified) return { status: "error", message: "This link is invalid or has expired. Ask for a new one." };

  const user = await db.user.findUnique({ where: { id: verified.userId } });
  if (!user || user.deletedAt || user.status === "SUSPENDED") {
    return { status: "error", message: "This account is not active. Contact your institution." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
    if (account) {
      await tx.account.update({ where: { id: account.id }, data: { password: passwordHash } });
    } else {
      await tx.account.create({
        data: { id: crypto.randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash },
      });
    }
    await tx.user.update({ where: { id: user.id }, data: { status: "ACTIVE", emailVerified: true } });
    await revokeAccountTokens(user.id, tx);
    await revokeSessions(user.id, tx);
    await audit(
      {
        actorId: user.id,
        action: verified.purpose === "invite" ? "user.acceptInvite" : "user.resetPassword",
        entityType: "User",
        entityId: user.id,
      },
      tx,
    );
  });

  await auth.api.signInEmail({
    body: { email: user.email, password: parsed.data.password },
    headers: await headers(),
  });
  redirect("/dashboard");
}

/** Admins manage every account; the office only manages student and guardian accounts. */
async function assertCanManageAccount(actor: CurrentUser, userId: string) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true, deletedAt: true, roles: { select: { role: true } } },
  });
  if (!target || target.deletedAt) throw new UserError("User not found.");
  const roles = target.roles.map((r) => r.role as Role);
  const allowed =
    hasPermission(actor.roles, "users.manage") ||
    (hasPermission(actor.roles, "students.manage") && isOfficeManageable(roles));
  if (!allowed) throw new ForbiddenError();
  return target;
}

const userIdSchema = z.object({ userId: z.string().min(1) });

export const resendInvite = command({ schema: userIdSchema }, async ({ userId }, actor) => {
  const target = await assertCanManageAccount(actor, userId);
  if (target.status !== "INVITED") throw new UserError("This user has already activated their account.");
  const result = await sendInvite(target);
  await audit({ actorId: actor.id, action: "user.invite", entityType: "User", entityId: userId });
  return { status: "success", data: result } satisfies ActionState<InviteResult>;
});

export const sendPasswordReset = command({ schema: userIdSchema }, async ({ userId }, actor) => {
  const target = await assertCanManageAccount(actor, userId);
  if (target.status !== "ACTIVE") throw new UserError("Only active accounts can reset their password.");
  const result = await sendPasswordResetLink(target);
  await audit({ actorId: actor.id, action: "user.sendPasswordReset", entityType: "User", entityId: userId });
  return { status: "success", data: result } satisfies ActionState<InviteResult>;
});
