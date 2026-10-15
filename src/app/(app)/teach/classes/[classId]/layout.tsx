import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TabLinks } from "@/components/tab-links";
import { requireClassStaff } from "@/features/academics/access";
import { ClassStatusBadge } from "@/features/academics/components/badges";
import { formatDate } from "@/lib/format";

export default async function TeachClassLayout({ children, params }: LayoutProps<"/teach/classes/[classId]">) {
  const { classId } = await params;
  const { klass } = await requireClassStaff(classId);
  const base = `/teach/classes/${classId}`;
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/teach"><ArrowLeft /> My classes</Link>
      </Button>
      <PageHeader title={klass.name} description={`${klass.course.title}${klass.term ? ` · ${klass.term.name}` : ""} · ${klass.code}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <ClassStatusBadge status={klass.status} />
        {klass.startDate ? (
          <span>
            {formatDate(klass.startDate, "UTC")}
            {klass.endDate ? ` – ${formatDate(klass.endDate, "UTC")}` : ""}
          </span>
        ) : null}
      </div>
      <TabLinks
        label="Class sections"
        tabs={[
          { href: base, label: "Overview" },
          { href: `${base}/content`, label: "Content" },
          { href: `${base}/assessments`, label: "Assessments" },
        ]}
      />
      {children}
    </>
  );
}
