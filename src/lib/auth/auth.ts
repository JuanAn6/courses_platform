import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/env";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const auth = betterAuth({
  appName: "Course Platform",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "mysql" }),
  emailAndPassword: {
    enabled: true,
    // Accounts are created by admins/secretaries (invites arrive in phase 2).
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    updateAge: 60 * 60 * 24, // refresh expiry once a day
  },
  databaseHooks: {
    session: {
      create: {
        // Only ACTIVE, non-deleted users may open a session.
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { status: true, deletedAt: true },
          });
          if (!user || user.deletedAt || user.status !== "ACTIVE") {
            throw new APIError("FORBIDDEN", { message: "This account is not active." });
          }
        },
        after: async (session) => {
          await db.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
          });
        },
      },
    },
  },
  // Must be last: lets Server Actions set auth cookies.
  plugins: [nextCookies()],
});
