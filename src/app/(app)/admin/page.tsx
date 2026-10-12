import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/features/settings/queries";
import { ROLE_PLURAL_LABELS, ROLES } from "@/lib/auth/permissions";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminOverviewPage() {
  await requireArea("admin");

  const [roleCounts, totalUsers, suspended, recent, { timezone }] = await Promise.all([
    db.userRole.groupBy({
      by: ["role"],
      where: { user: { deletedAt: null } },
      _count: { _all: true },
    }),
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, status: "SUSPENDED" } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { name: true } } },
    }),
    getSettings("general"),
  ]);
  const countFor = new Map(roleCounts.map((r) => [r.role, r._count._all]));

  return (
    <>
      <PageHeader title="Administration" description="An overview of the people on the platform." />

      <section aria-labelledby="people-heading" className="mb-8">
        <h2 id="people-heading" className="sr-only">
          People
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Stat label="Users" value={totalUsers} />
          {ROLES.map((role) => (
            <Stat key={role} label={ROLE_PLURAL_LABELS[role]} value={countFor.get(role) ?? 0} />
          ))}
          <Stat label="Suspended" value={suspended} />
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest audited changes.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/audit-log">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recent.map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{entry.actor?.name ?? "System"}</span>{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">{entry.action}</code>
                  </span>
                  <time className="text-muted-foreground" dateTime={entry.createdAt.toISOString()}>
                    {formatDateTime(entry.createdAt, timezone)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
