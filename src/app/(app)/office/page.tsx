import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Office" };

export default async function OfficeOverviewPage() {
  await requireArea("office");
  const [byStatus, guardians] = await Promise.all([
    db.studentProfile.groupBy({
      by: ["status"],
      where: { user: { deletedAt: null } },
      _count: { _all: true },
    }),
    db.userRole.count({ where: { role: "GUARDIAN", user: { deletedAt: null } } }),
  ]);
  const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;

  const stats = [
    { label: "Active students", value: count("ACTIVE") },
    { label: "Graduated", value: count("GRADUATED") },
    { label: "Withdrawn", value: count("WITHDRAWN") },
    { label: "Guardians", value: guardians },
  ];

  return (
    <>
      <PageHeader title="Office" description="Student records, enrollments, invoices and reports." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="gap-1 py-4">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
