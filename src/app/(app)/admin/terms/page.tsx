import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { listTerms } from "@/features/academics/queries";
import { requirePermission } from "@/lib/auth/session";
import { TermManager } from "./term-manager";

export const metadata: Metadata = { title: "Terms" };

export default async function TermsPage() {
  await requirePermission("courses.manage");
  const terms = await listTerms();
  return (
    <>
      <PageHeader title="Academic terms" description="Periods such as semesters or trimesters. Classes belong to a term." />
      <TermManager
        terms={terms.map((t) => ({
          id: t.id,
          name: t.name,
          startDate: t.startDate.toISOString().slice(0, 10),
          endDate: t.endDate.toISOString().slice(0, 10),
          classCount: t._count.classes,
        }))}
      />
    </>
  );
}
