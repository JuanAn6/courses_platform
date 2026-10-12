"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { action, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { safeRedirectPath } from "@/lib/safe-redirect";

const signInSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

/** Public action (no session required), so it doesn't use the `action` wrapper. */
export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { email, password, next } = parsed.data;
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      // FORBIDDEN carries our "account is not active" message; anything else is a bad login.
      const message =
        error.status === "FORBIDDEN" ? error.message : "Invalid email or password.";
      return { status: "error", message };
    }
    console.error("[signIn] unexpected error", error);
    return { status: "error", message: "Could not sign in. Please try again." };
  }

  redirect(safeRedirectPath(next));
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const changePassword = action({ schema: changePasswordSchema }, async (input, user) => {
  const requestHeaders = await headers();
  try {
    // Not using Better Auth's revokeOtherSessions: it rotates the current session cookie mid-action,
    // and the re-render that follows still sees the revoked token. We revoke the others ourselves.
    await auth.api.changePassword({
      body: { currentPassword: input.currentPassword, newPassword: input.newPassword },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        status: "error",
        message: "Current password is incorrect.",
        fieldErrors: { currentPassword: ["Current password is incorrect"] },
      };
    }
    throw error;
  }
  const current = await auth.api.getSession({ headers: requestHeaders });
  await db.session.deleteMany({
    where: { userId: user.id, ...(current ? { token: { not: current.session.token } } : {}) },
  });
  await audit({ actorId: user.id, action: "user.changePassword", entityType: "User", entityId: user.id });
  return { status: "success", message: "Password changed. Other sessions were signed out." };
});
