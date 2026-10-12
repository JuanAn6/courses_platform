"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { action, command, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth/auth";
import type { Role } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { diffObjects } from "@/lib/diff";
import {
  assertEmailAvailable,
  countActiveAdmins,
  createInvitedUser,
  ensureStudentCodeSequence,
  revokeSessions,
  sendInvite,
  setUserRoles,
  type InviteResult,
} from "@/features/accounts/service";
import { revokeAccountTokens } from "@/features/accounts/tokens";
import { checkAccountChange, type AccountChange } from "./rules";
import { inviteUserSchema, updateUserSchema } from "./schemas";

export type InviteUserData = { userId: string; invite: InviteResult | null };

export const inviteUser = action({ permission: "users.manage", schema: inviteUserSchema }, async (input, actor) => {
  if (input.roles.includes("STUDENT")) await ensureStudentCodeSequence();
  const user = await db.$transaction(async (tx) => {
    const created = await createInvitedUser(tx, input);
    await audit(
      { actorId: actor.id, action: "user.create", entityType: "User", entityId: created.id, diff: { roles: input.roles } },
      tx,
    );
    return created;
  });
  const invite = input.sendInvite ? await sendInvite(user) : null;
  revalidatePath("/admin/users");
  return { status: "success", data: { userId: user.id, invite } } satisfies ActionState<InviteUserData>;
});

async function loadTarget(userId: string) {
  const target = await db.user.findUnique({
    where: { id: userId },
    include: { roles: { select: { role: true } } },
  });
  if (!target) throw new UserError("User not found.");
  return { ...target, roleList: target.roles.map((r) => r.role) };
}

async function guard(actorId: string, target: { id: string; roleList: Role[] }, change: AccountChange) {
  const refusal = checkAccountChange({
    actorId,
    targetId: target.id,
    targetRoles: target.roleList,
    activeAdminCount: await countActiveAdmins(),
    change,
  });
  if (refusal) throw new UserError(refusal);
}

export const updateUser = action({ permission: "users.manage", schema: updateUserSchema }, async (input, actor) => {
  const target = await loadTarget(input.userId);
  if (target.deletedAt) throw new UserError("Restore this account before editing it.");
  await guard(actor.id, target, { kind: "roles", nextRoles: input.roles });
  if (input.roles.includes("STUDENT")) await ensureStudentCodeSequence();

  await db.$transaction(async (tx) => {
    if (input.email !== target.email) await assertEmailAvailable(tx, input.email, target.id);
    await tx.user.update({
      where: { id: target.id },
      data: { name: input.name, email: input.email, phone: input.phone },
    });
    await setUserRoles(tx, target.id, input.roles);
    const diff = diffObjects(
      { name: target.name, email: target.email, phone: target.phone, roles: [...target.roleList].sort() },
      { name: input.name, email: input.email, phone: input.phone, roles: [...input.roles].sort() },
    );
    if (Object.keys(diff.before).length > 0) {
      await audit({ actorId: actor.id, action: "user.update", entityType: "User", entityId: target.id, diff }, tx);
    }
  });
  revalidatePath(`/admin/users/${target.id}`);
  return { status: "success", message: "User saved." };
});

const userIdSchema = z.object({ userId: z.string().min(1) });

export const setUserSuspended = command(
  { permission: "users.manage", schema: userIdSchema.extend({ suspended: z.boolean() }) },
  async ({ userId, suspended }, actor) => {
    const target = await loadTarget(userId);
    if (target.deletedAt) throw new UserError("This account is archived.");
    if (suspended) {
      await guard(actor.id, target, { kind: "suspend" });
      if (target.status !== "ACTIVE") throw new UserError("Only active accounts can be suspended.");
    } else if (target.status !== "SUSPENDED") {
      throw new UserError("This account isn't suspended.");
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } });
      if (suspended) {
        await revokeSessions(userId, tx);
        await revokeAccountTokens(userId, tx);
      }
      await audit(
        { actorId: actor.id, action: suspended ? "user.suspend" : "user.reactivate", entityType: "User", entityId: userId },
        tx,
      );
    });
    revalidatePath(`/admin/users/${userId}`);
    return { status: "success", message: suspended ? "Account suspended." : "Account reactivated." };
  },
);

export const setUserArchived = command(
  { permission: "users.manage", schema: userIdSchema.extend({ archived: z.boolean() }) },
  async ({ userId, archived }, actor) => {
    const target = await loadTarget(userId);
    if (archived) {
      if (target.deletedAt) throw new UserError("This account is already archived.");
      await guard(actor.id, target, { kind: "archive" });
    } else if (!target.deletedAt) {
      throw new UserError("This account isn't archived.");
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { deletedAt: archived ? new Date() : null } });
      if (archived) {
        await revokeSessions(userId, tx);
        await revokeAccountTokens(userId, tx);
      }
      await audit(
        { actorId: actor.id, action: archived ? "user.archive" : "user.restore", entityType: "User", entityId: userId },
        tx,
      );
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { status: "success", message: archived ? "Account archived." : "Account restored." };
  },
);

export const impersonateUser = command(
  { permission: "users.impersonate", schema: userIdSchema },
  async ({ userId }, actor) => {
    try {
      await auth.api.startImpersonating({ body: { userId }, headers: await headers() });
    } catch (error) {
      if (error instanceof APIError) throw new UserError(error.message);
      throw error;
    }
    await audit({ actorId: actor.id, action: "user.impersonate.start", entityType: "User", entityId: userId });
    redirect("/dashboard");
  },
);

/** Called by the impersonated session itself, so it can't require admin permissions. */
export async function stopImpersonating() {
  const user = await getCurrentUser();
  if (!user?.impersonator) redirect("/dashboard");
  await auth.api.stopImpersonating({ headers: await headers() });
  await audit({ actorId: user.impersonator.id, action: "user.impersonate.stop", entityType: "User", entityId: user.id });
  redirect(`/admin/users/${user.id}`);
}
