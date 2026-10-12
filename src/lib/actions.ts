import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

/** State returned by every form Server Action (consumed with useActionState). */
export type ActionState<T = unknown> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: T }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[] | undefined> };

export const idleState: ActionState = { status: "idle" };

export class AuthError extends Error {
  constructor(message = "You must be signed in.") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Expected, user-facing failure (e.g. "email already in use"). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/**
 * Server-side authorization gate. Every mutation goes through this (directly or via `action`).
 * Resource-scoped checks (class staff, enrollment) are layered on in later phases.
 */
export async function authorize(permission?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (permission && !hasPermission(user.roles, permission)) throw new ForbiddenError();
  return user;
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue; // React internals
    const values = formData.getAll(key);
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

/**
 * Wraps a form Server Action: authorizes, validates FormData with Zod, and maps errors
 * to an ActionState. The handler returns an ActionState (or nothing, meaning success).
 * Redirects/notFound thrown inside the handler propagate normally.
 */
export function action<S extends z.ZodType, R = never>(
  opts: { permission?: Permission; schema: S },
  handler: (input: z.output<S>, user: CurrentUser) => Promise<ActionState<R> | void>,
) {
  return async (_prev: ActionState<unknown>, formData: FormData): Promise<ActionState<R>> => {
    try {
      const user = await authorize(opts.permission);
      const parsed = opts.schema.safeParse(formDataToObject(formData));
      if (!parsed.success) {
        return {
          status: "error",
          message: "Please fix the highlighted fields.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }
      return (await handler(parsed.data, user)) ?? { status: "success" };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof AuthError || error instanceof ForbiddenError || error instanceof UserError) {
        return { status: "error", message: error.message };
      }
      console.error("[action] unexpected error", error);
      return { status: "error", message: "Something went wrong. Please try again." };
    }
  };
}
