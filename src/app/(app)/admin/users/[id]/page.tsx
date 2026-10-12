import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RoleBadges, UserStatusBadge } from "@/components/status-badges";
import { getSettings } from "@/features/settings/queries";
import { getUserDetail } from "@/features/users/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { EditUserForm } from "./edit-user-form";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "User" };

export default async function UserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const actor = await requirePermission("users.manage");
  const { id } = await params;
  const [user, { timezone }] = await Promise.all([getUserDetail(id), getSettings("general")]);
  if (!user) notFound();

  const archived = !!user.deletedAt;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/users">
          <ArrowLeft /> Users
        </Link>
      </Button>
      <PageHeader title={user.name} description={user.email} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <UserStatusBadge status={user.status} archived={archived} />
        <RoleBadges roles={user.roles} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Name, contact and roles.</CardDescription>
            </CardHeader>
            <CardContent>
              {archived ? (
                <p className="text-sm text-muted-foreground">Restore this account to edit it.</p>
              ) : (
                <EditUserForm
                  user={{ id: user.id, name: user.name, email: user.email, phone: user.phone ?? "", roles: user.roles }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Changes to this account and actions taken by this user.</CardDescription>
            </CardHeader>
            <CardContent>
              {user.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {user.recentActivity.map((e) => (
                    <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        <span className="font-medium">{e.actor?.name ?? "System"}</span>{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">{e.action}</code>
                      </span>
                      <time className="text-muted-foreground" dateTime={e.createdAt.toISOString()}>
                        {formatDateTime(e.createdAt, timezone)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDateTime(user.createdAt, timezone)}</dd>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt, timezone) : "Never"}</dd>
                <dt className="text-muted-foreground">Password</dt>
                <dd>{user.hasPassword ? "Set" : "Not set yet"}</dd>
                <dt className="text-muted-foreground">Sessions</dt>
                <dd>{user.activeSessions}</dd>
                {user.studentProfile ? (
                  <>
                    <dt className="text-muted-foreground">Student</dt>
                    <dd>
                      <Link href={`/office/students/${user.id}`} className="underline underline-offset-4">
                        {user.studentProfile.studentCode}
                      </Link>
                    </dd>
                  </>
                ) : null}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <UserActions
                user={{
                  id: user.id,
                  name: user.name,
                  status: user.status,
                  archived,
                  isAdmin: user.roles.includes("ADMIN"),
                  isSelf: user.id === actor.id,
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
