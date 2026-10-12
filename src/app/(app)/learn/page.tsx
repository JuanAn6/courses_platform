import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My classes" };

export default async function LearnOverviewPage() {
  await requireArea("learn");
  return (
    <>
      <PageHeader title="My classes" description="Your classes, lessons, quizzes and grades." />
      <EmptyState
        icon={BookOpen}
        title="You're not enrolled in any classes yet"
        description="Once the office enrolls you in a class, it will show up here."
      />
    </>
  );
}
