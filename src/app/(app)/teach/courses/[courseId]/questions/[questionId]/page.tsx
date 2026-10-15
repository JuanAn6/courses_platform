import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionForm } from "@/features/assessment/components/question-form";
import { getQuestion } from "@/features/assessment/question-queries";
import { parseTags } from "@/features/assessment/tags";

export const metadata: Metadata = { title: "Edit question" };

export default async function EditQuestionPage({ params }: PageProps<"/teach/courses/[courseId]/questions/[questionId]">) {
  const { courseId, questionId } = await params;
  const q = await getQuestion(questionId);
  if (!q || q.courseId !== courseId) notFound();
  return (
    <QuestionForm
      key={q.updatedAt.toISOString()}
      courseId={courseId}
      question={{
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        data: q.data as Record<string, unknown>,
        explanation: q.explanation ?? "",
        points: q.points,
        tags: parseTags(q.tags).join(", "),
        difficulty: q.difficulty,
      }}
    />
  );
}
