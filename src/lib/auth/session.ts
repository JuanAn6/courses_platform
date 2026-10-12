import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  canAccessArea,
  hasPermission,
  type Area,
  type Permission,
  type Role,
} from "@/lib/auth/permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  roles: Role[];
  /** Set when an admin is viewing the app as this user. */
  impersonator: { id: string; name: string } | null;
};

/** The signed-in user with their roles, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      status: true,
      deletedAt: true,
      roles: { select: { role: true } },
    },
  });
  // A user suspended mid-session loses access on the next request.
  if (!user || user.deletedAt || user.status !== "ACTIVE") return null;

  const impersonatedBy = (session.session as { impersonatedBy?: string | null }).impersonatedBy;
  const impersonator = impersonatedBy
    ? await db.user.findUnique({ where: { id: impersonatedBy }, select: { id: true, name: true } })
    : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    roles: user.roles.map((r) => r.role),
    impersonator,
  };
});

/** For pages/layouts: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For area layouts: redirects to /forbidden when the user's roles don't allow the area. */
export async function requireArea(area: Area): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccessArea(user.roles, area)) redirect("/forbidden");
  return user;
}

/** For pages: redirects to /forbidden when the permission is missing. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.roles, permission)) redirect("/forbidden");
  return user;
}
