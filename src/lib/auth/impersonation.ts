import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { deleteSessionCookie, expireCookie, setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

export const IMPERSONATION_TTL_SECONDS = 60 * 60;

/**
 * "View as" for admins, modeled on Better Auth's admin plugin but using our own role model.
 * Start: creates a short-lived session for the target (session.impersonatedBy = actor) and keeps
 * the actor's session token in a signed `admin_session` cookie. Stop: restores the actor's session.
 */
export function impersonation(options: {
  /** Return null to allow, or a reason string to refuse. */
  authorize: (actorId: string, targetId: string) => Promise<string | null>;
}) {
  return {
    id: "impersonation",
    schema: {
      session: { fields: { impersonatedBy: { type: "string", required: false } } },
    },
    endpoints: {
      startImpersonating: createAuthEndpoint(
        "/impersonation/start",
        { method: "POST", body: z.object({ userId: z.string().min(1) }), use: [sessionMiddleware] },
        async (ctx) => {
          const actor = ctx.context.session;
          if ((actor.session as { impersonatedBy?: string | null }).impersonatedBy) {
            throw new APIError("BAD_REQUEST", { message: "Stop the current impersonation first." });
          }
          const refusal = await options.authorize(actor.user.id, ctx.body.userId);
          if (refusal) throw new APIError("FORBIDDEN", { message: refusal });

          const target = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
          if (!target) throw new APIError("NOT_FOUND", { message: "User not found." });

          const session = await ctx.context.internalAdapter.createSession(
            target.id,
            true,
            {
              impersonatedBy: actor.user.id,
              expiresAt: new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000),
            },
            true,
          );
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not start session." });

          const cookies = ctx.context.authCookies;
          deleteSessionCookie(ctx);
          const adminCookie = ctx.context.createAuthCookie("admin_session");
          await ctx.setSignedCookie(
            adminCookie.name,
            actor.session.token,
            ctx.context.secret,
            cookies.sessionToken.attributes,
          );
          await setSessionCookie(ctx, { session, user: target }, true);
          return ctx.json({ userId: target.id });
        },
      ),
      stopImpersonating: createAuthEndpoint(
        "/impersonation/stop",
        { method: "POST", requireHeaders: true },
        async (ctx) => {
          const current = await getSessionFromCtx(ctx);
          const impersonatedBy = (current?.session as { impersonatedBy?: string | null } | undefined)
            ?.impersonatedBy;
          if (!current || !impersonatedBy) {
            throw new APIError("BAD_REQUEST", { message: "You are not impersonating anyone." });
          }

          const adminCookie = ctx.context.createAuthCookie("admin_session");
          const adminToken = await ctx.getSignedCookie(adminCookie.name, ctx.context.secret);
          const adminSession = adminToken ? await ctx.context.internalAdapter.findSession(adminToken) : null;

          await ctx.context.internalAdapter.deleteSession(current.session.token);
          expireCookie(ctx, adminCookie);

          if (!adminSession || adminSession.user.id !== impersonatedBy) {
            // Admin session expired meanwhile: just sign out.
            deleteSessionCookie(ctx);
            return ctx.json({ restored: false });
          }
          await setSessionCookie(ctx, adminSession, false);
          return ctx.json({ restored: true });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
