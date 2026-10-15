import type { Metadata } from "next";
import { QuestionForm } from "@/features/assessment/components/question-form";

export const metadata: Metadata = { title: "New question" };

export default async function NewQuestionPage({ params }: PageProps<"/teach/courses/[courseId]/questions/new">) {
  const { courseId } = await params;
  return <QuestionForm courseId={courseId} />;
}
