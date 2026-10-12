import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { MAX_IMPORT_ROWS, STUDENT_IMPORT_COLUMNS, STUDENT_IMPORT_TEMPLATE } from "@/features/students/csv";
import { requirePermission } from "@/lib/auth/session";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import students" };

export default async function ImportStudentsPage() {
  await requirePermission("students.manage");
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/office/students">
          <ArrowLeft /> Students
        </Link>
      </Button>
      <PageHeader
        title="Import students"
        description={`Upload a CSV (up to ${MAX_IMPORT_ROWS} rows). You'll see a preview before anything is saved.`}
      />
      <ImportWizard template={STUDENT_IMPORT_TEMPLATE} columns={[...STUDENT_IMPORT_COLUMNS]} />
    </>
  );
}
