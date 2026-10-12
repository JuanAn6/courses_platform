import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { Pager, searchParam } from "@/components/pager";
import { RoleBadges, UserStatusBadge } from "@/components/status-badges";
import { getSettings } from "@/features/settings/queries";
import { listUsers } from "@/features/users/queries";
import { USER_STATUS_FILTERS, type UserStatusFilter } from "@/features/users/schemas";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requirePermission("users.manage");
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const roleParam = searchParam(sp.role);
  const role = ROLES.includes(roleParam as Role) ? (roleParam as Role) : undefined;
  const statusParam = searchParam(sp.status);
  const status = USER_STATUS_FILTERS.includes(statusParam as UserStatusFilter)
    ? (statusParam as UserStatusFilter)
    : "all";
  const cursor = searchParam(sp.cursor);

  const [{ users, nextCursor }, { timezone }] = await Promise.all([
    listUsers({ q, role, status, cursor }),
    getSettings("general"),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with an account: staff, students and guardians."
        actions={
          <Button asChild>
            <Link href="/admin/users/new">
              <UserPlus /> Invite user
            </Link>
          </Button>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem_10rem_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search</label>
        <Input id="q" name="q" placeholder="Search name or email" defaultValue={q} />
        <label className="sr-only" htmlFor="role">Role</label>
        <NativeSelect id="role" name="role" defaultValue={role ?? ""}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </NativeSelect>
        <label className="sr-only" htmlFor="status">Status</label>
        <NativeSelect id="status" name="status" defaultValue={status}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </NativeSelect>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No users match these filters.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                      {u.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell><RoleBadges roles={u.roles} /></TableCell>
                  <TableCell><UserStatusBadge status={u.status} archived={!!u.deletedAt} /></TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt, timezone) : "Never"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pager basePath="/admin/users" params={{ q, role, status: status === "all" ? undefined : status }} cursor={cursor} nextCursor={nextCursor} />
    </>
  );
}
