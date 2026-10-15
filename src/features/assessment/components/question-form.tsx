"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { RichTextEditor } from "@/features/entries/rich-text/rich-text-editor";
import { RichTextView } from "@/features/entries/rich-text/rich-text-view";
import { EMPTY_DOC } from "@/features/entries/rich-text/sanitize";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";
import { saveQuestion, type SaveQuestionResult } from "../question-actions";
import { QUESTION_TYPE_INFO, questionDataSchemas, studentView, emptyResponse, type QuestionType } from "../questions";
import { defaultQuestionData, QuestionDataEditor } from "./question-data-editor";
import { QuestionInput } from "./question-input";

export type QuestionFormValues = {
  id?: string;
  type: QuestionType;
  prompt: unknown;
  data: Record<string, unknown>;
  explanation: string;
  points: number;
  tags: string;
  difficulty: number | null;
};

/** Drops half-typed blank entries before saving. */
function cleanData(type: QuestionType, data: Record<string, unknown>) {
  if (type === "SHORT_ANSWER") return { ...data, accepted: (data.accepted as string[]).map((a) => a.trim()).filter(Boolean) };
  return data;
}

const initial: ActionState<SaveQuestionResult> = { status: "idle" };

export function QuestionForm({ courseId, question }: { courseId: string; question?: QuestionFormValues }) {
  const router = useRouter();
  const [type, setType] = useState<QuestionType>(question?.type ?? "SINGLE_CHOICE");
  const [prompt, setPrompt] = useState<unknown>(question?.prompt ?? EMPTY_DOC);
  const [data, setData] = useState<Record<string, unknown>>(question?.data ?? defaultQuestionData("SINGLE_CHOICE"));
  const [previewAnswer, setPreviewAnswer] = useState<Record<string, unknown>>({});
  const { state, formAction, onSubmit, pending } = useActionForm(saveQuestion, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  useActionToast(
    state,
    (s) => {
      if (!question?.id && s.data) router.push(`/teach/courses/${courseId}/questions/${s.data.questionId}`);
    },
    { toastErrors: false },
  );

  const cleaned = cleanData(type, data);
  const preview = useMemo(() => {
    const parsed = questionDataSchemas[type].safeParse(cleaned);
    return parsed.success ? studentView(type, parsed.data, "preview", false) : null;
  }, [type, cleaned]);

  return (
    <form action={formAction} onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1fr_22rem]" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {question?.id ? <input type="hidden" name="questionId" value={question.id} /> : null}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="prompt" value={JSON.stringify(prompt)} />
      <input type="hidden" name="data" value={JSON.stringify(cleaned)} />

      <div className="grid content-start gap-6">
        {state.status === "error" ? (
          <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>
        ) : null}
        <Card>
          <CardContent className="grid gap-4">
            <FormField id="qtype" label="Question type">
              <NativeSelect
                id="qtype"
                value={type}
                disabled={!!question?.id}
                onChange={(e) => {
                  const next = e.target.value as QuestionType;
                  setType(next);
                  setData(defaultQuestionData(next));
                  setPreviewAnswer({});
                }}
              >
                {Object.entries(QUESTION_TYPE_INFO).map(([t, info]) => (
                  <option key={t} value={t}>{info.label}{info.manual ? " (teacher-graded)" : ""}</option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Question</span>
              <RichTextEditor value={prompt} onChange={setPrompt} placeholder="Write the question…" label="Question" />
              {errors?.prompt ? <p className="text-sm text-destructive">{errors.prompt[0]}</p> : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Answer</CardTitle></CardHeader>
          <CardContent>
            <QuestionDataEditor type={type} value={data} onChange={setData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Student preview</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <RichTextView doc={prompt} />
            {preview ? (
              <QuestionInput name="preview" view={preview} value={Object.keys(previewAnswer).length ? previewAnswer : (emptyResponse(type) as Record<string, unknown>)} onChange={setPreviewAnswer} />
            ) : (
              <p className="text-sm text-muted-foreground">Complete the answer settings to see the preview.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardContent className="grid gap-4">
          <FormField id="points" label="Points" error={errors?.points}>
            <Input id="points" name="points" type="number" min={0} step="0.5" defaultValue={question?.points ?? 1} className="w-28" />
          </FormField>
          <FormField id="tags" label="Tags" error={errors?.tags} hint="Comma-separated. Quizzes can draw random questions by tag.">
            <Input id="tags" name="tags" defaultValue={question?.tags ?? ""} placeholder="equations, unit-1" />
          </FormField>
          <FormField id="difficulty" label="Difficulty">
            <NativeSelect id="difficulty" name="difficulty" defaultValue={question?.difficulty ? String(question.difficulty) : ""}>
              <option value="">Not set</option>
              <option value="1">Easy</option>
              <option value="2">Medium</option>
              <option value="3">Hard</option>
            </NativeSelect>
          </FormField>
          <FormField id="explanation" label="Explanation" error={errors?.explanation} hint="Shown with the results, if the quiz allows it.">
            <Textarea id="explanation" name="explanation" rows={4} defaultValue={question?.explanation ?? ""} />
          </FormField>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save question"}</Button>
        </CardContent>
      </Card>
    </form>
  );
}
