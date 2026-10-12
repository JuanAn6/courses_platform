import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { NewStudentForm } from "./new-student-form";

export const metadata: Metadata = { title: "Add student" };

export default async function NewStudentPage() {
  await requirePermission("students.manage");
  return (
    <>
      <PageHeader title="Add student" description="Creates the student record and their account." />
      <NewStudentForm />
    </>
  );
}
