import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Teaching" };

export default async function TeachOverviewPage() {
  await requireArea("teach");
  return (
    <>
      <PageHeader title="Teaching" description="Your classes, course content, grading and attendance." />
      <EmptyState
        icon={GraduationCap}
        title="No classes yet"
        description="Classes you're assigned to as a teacher or assistant will appear here."
      />
    </>
  );
}
