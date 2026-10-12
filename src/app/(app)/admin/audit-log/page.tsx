import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/features/settings/queries";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

function param(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  await requirePermission("auditLog.view");
  const sp = await searchParams;
  const action = param(sp.action);
  const cursor = param(sp.cursor);

  const where: Prisma.AuditLogWhereInput = action ? { action: { startsWith: action } } : {};
  const [rows, { timezone }] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { actor: { select: { name: true, email: true } } },
    }),
    getSettings("general"),
  ]);
  const hasMore = rows.length > PAGE_SIZE;
  const entries = rows.slice(0, PAGE_SIZE);

  const olderHref = (() => {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    q.set("cursor", entries[entries.length - 1]?.id ?? "");
    return `/admin/audit-log?${q}`;
  })();

  return (
    <>
      <PageHeader title="Audit log" description="Every change to important data, newest first." />

      <form className="mb-4 flex max-w-md gap-2" role="search">
        <label htmlFor="action" className="sr-only">
          Filter by action
        </label>
        <Input id="action" name="action" placeholder="Filter by action, e.g. settings." defaultValue={action} />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <time dateTime={e.createdAt.toISOString()}>{formatDateTime(e.createdAt, timezone)}</time>
                  </TableCell>
                  <TableCell>
                    {e.actor ? (
                      <>
                        <div>{e.actor.name}</div>
                        <div className="text-xs text-muted-foreground">{e.actor.email}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">{e.action}</code>
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.entityType}
                    {e.entityId ? <span className="block text-xs text-muted-foreground">{e.entityId}</span> : null}
                  </TableCell>
                  <TableCell className="max-w-sm">
                    {e.diff ? (
                      <details>
                        <summary className="cursor-pointer text-sm text-muted-foreground">Changes</summary>
                        <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(e.diff, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                    {e.ip ? <span className="block text-xs text-muted-foreground">IP {e.ip}</span> : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex gap-2">
        {cursor ? (
          <Button variant="outline" asChild>
            <Link href={action ? `/admin/audit-log?action=${encodeURIComponent(action)}` : "/admin/audit-log"}>
              Back to latest
            </Link>
          </Button>
        ) : null}
        {hasMore ? (
          <Button variant="outline" asChild>
            <Link href={olderHref}>Older entries</Link>
          </Button>
        ) : null}
      </div>
    </>
  );
}
