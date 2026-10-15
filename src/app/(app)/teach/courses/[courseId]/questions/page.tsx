import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks, Plus } from "lucide-react";
import type { QuestionType } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { searchParam } from "@/components/pager";
import { canEditCourse } from "@/features/academics/access";
import { bankTags, listQuestions } from "@/features/assessment/question-queries";
import { QUESTION_TYPE_INFO, QUESTION_TYPES } from "@/features/assessment/questions";
import { plainText } from "@/features/entries/rich-text/sanitize";
import { requireArea } from "@/lib/auth/session";
import { QuestionRowActions } from "./question-row-actions";

export const metadata: Metadata = { title: "Question bank" };

export default async function QuestionBankPage({ params, searchParams }: PageProps<"/teach/courses/[courseId]/questions">) {
  const user = await requireArea("teach");
  const { courseId } = await params;
  if (!(await canEditCourse(user, courseId))) redirect("/forbidden");
  const sp = await searchParams;
  const q = searchParam(sp.q)?.toLowerCase();
  const typeParam = searchParam(sp.type);
  const type = QUESTION_TYPES.includes(typeParam as QuestionType) ? (typeParam as QuestionType) : undefined;
  const tag = searchParam(sp.tag);
  const [questions, tags] = await Promise.all([listQuestions(courseId, { type, tag }), bankTags(courseId)]);
  // Prompts are rich-text JSON, so text search happens here rather than in SQL.
  const shown = q ? questions.filter((x) => plainText(x.prompt, 10_000).toLowerCase().includes(q) || x.tags.includes(q)) : questions;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <form className="grid flex-1 gap-2 sm:grid-cols-[1fr_12rem_10rem_auto]" role="search">
          <label className="sr-only" htmlFor="q">Search</label>
          <Input id="q" name="q" placeholder="Search questions" defaultValue={q} />
          <label className="sr-only" htmlFor="type">Type</label>
          <NativeSelect id="type" name="type" defaultValue={type ?? ""}>
            <option value="">All types</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>{QUESTION_TYPE_INFO[t].label}</option>
            ))}
          </NativeSelect>
          <label className="sr-only" htmlFor="tag">Tag</label>
          <NativeSelect id="tag" name="tag" defaultValue={tag ?? ""}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline">Filter</Button>
        </form>
        <Button asChild>
          <Link href={`/teach/courses/${courseId}/questions/new`}><Plus /> New question</Link>
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={ListChecks} title="No questions" description="Questions you add here can be used in any quiz of this course." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="w-16">Points</TableHead>
                <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="max-w-md">
                    <Link href={`/teach/courses/${courseId}/questions/${x.id}`} className="line-clamp-2 hover:underline">
                      {plainText(x.prompt, 160) || "(no text)"}
                    </Link>
                    {x.tags.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {x.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{QUESTION_TYPE_INFO[x.type].label}</TableCell>
                  <TableCell className="tabular-nums">{x.points}</TableCell>
                  <TableCell>
                    <QuestionRowActions questionId={x.id} label={plainText(x.prompt, 40)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
