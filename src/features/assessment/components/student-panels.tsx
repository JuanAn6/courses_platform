"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, PlayCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/features/entries/components/file-picker";
import { formatBytes } from "@/lib/files";
import { submitAssignment } from "../assignment-actions";
import { startQuiz } from "../quiz-actions";
import type { Rubric } from "../rubric";

export type QuizPanelData = {
  kind: "quiz";
  classId: string;
  entryId: string;
  questionCount: number;
  totalPoints: number;
  timeLimitMin: number | null;
  maxAttempts: number;
  scoring: "highest" | "last" | "average";
  passingPercent: number | null;
  attempts: { id: string; number: number; status: string; score: number | null; maxScore: number; submittedLabel: string | null }[];
  inProgressId: string | null;
  refusal: string | null;
  resultsVisible: boolean;
  grade: { score: number | null; maxScore: number } | null;
};

export type AssignmentPanelData = {
  kind: "assignment";
  classId: string;
  entryId: string;
  allowText: boolean;
  allowFiles: boolean;
  maxFiles: number;
  allowResubmission: boolean;
  maxScore: number;
  rubric: Rubric | null;
  submissions: { id: string; number: number; text: string | null; files: { id: string; name: string; size: number }[]; submittedLabel: string; late: boolean }[];
  grade: { score: number | null; maxScore: number; feedback: string | null; rubric: Record<string, string> | null } | null;
};

const SCORING = { highest: "best attempt", last: "last attempt", average: "average of attempts" } as const;

export function QuizPanel({ data, preview }: { data: QuizPanelData; preview: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const facts = [
    `${data.questionCount} question${data.questionCount === 1 ? "" : "s"}`,
    `${data.totalPoints} point${data.totalPoints === 1 ? "" : "s"}`,
    data.timeLimitMin ? `${data.timeLimitMin} minute limit` : "No time limit",
    data.maxAttempts ? `${data.maxAttempts} attempt${data.maxAttempts === 1 ? "" : "s"}` : "Unlimited attempts",
    ...(data.maxAttempts !== 1 ? [`Grade from your ${SCORING[data.scoring]}`] : []),
    ...(data.passingPercent !== null ? [`Pass mark ${data.passingPercent}%`] : []),
  ];

  return (
    <div className="grid gap-4">
      <ul className="flex flex-wrap gap-2">
        {facts.map((f) => (
          <li key={f}><Badge variant="secondary">{f}</Badge></li>
        ))}
      </ul>
      {data.grade?.score != null && data.resultsVisible ? (
        <p className="text-sm">
          Your grade: <span className="font-semibold tabular-nums">{data.grade.score} / {data.grade.maxScore}</span>
        </p>
      ) : null}
      {data.attempts.length ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attempt</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.attempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>#{a.number}</TableCell>
                  <TableCell className="text-muted-foreground">{a.submittedLabel ?? "In progress"}</TableCell>
                  <TableCell className="tabular-nums">
                    {a.status === "IN_PROGRESS" ? "—" : a.status === "NEEDS_GRADING" ? "Awaiting grading" : data.resultsVisible ? `${a.score} / ${a.maxScore}` : "Hidden"}
                  </TableCell>
                  <TableCell>
                    {a.status !== "IN_PROGRESS" && data.resultsVisible ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/learn/classes/${data.classId}/quiz/${a.id}/results`}>Review</Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {preview ? (
        <p className="text-sm text-muted-foreground">Students start the quiz from here.</p>
      ) : data.inProgressId ? (
        <div>
          <Button asChild>
            <Link href={`/learn/classes/${data.classId}/quiz/${data.inProgressId}`}><PlayCircle /> Resume attempt</Link>
          </Button>
        </div>
      ) : data.refusal ? (
        <p className="text-sm text-muted-foreground">{data.refusal}</p>
      ) : (
        <div>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await startQuiz({ classId: data.classId, entryId: data.entryId });
                if (res.status === "error") toast.error(res.message);
                else if (res.status === "success" && res.data) router.push(res.data.url);
              })
            }
          >
            <PlayCircle /> {pending ? "Starting…" : data.attempts.length ? "Start a new attempt" : "Start quiz"}
          </Button>
          {data.timeLimitMin ? <p className="mt-2 text-xs text-muted-foreground">The timer starts when you begin and keeps running if you leave.</p> : null}
        </div>
      )}
    </div>
  );
}

export function RubricTable({ rubric, selected }: { rubric: Rubric; selected?: Record<string, string> | null }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">Rubric</caption>
        <tbody>
          {rubric.criteria.map((c) => (
            <tr key={c.id} className="border-b last:border-0">
              <th scope="row" className="w-40 bg-muted/40 p-2 text-left align-top font-medium">{c.title}</th>
              {c.levels.map((l) => {
                const isSelected = selected?.[c.id] === l.id;
                return (
                  <td key={l.id} className={`p-2 align-top ${isSelected ? "bg-primary/10 font-medium" : ""}`} aria-selected={isSelected || undefined}>
                    {l.label} <span className="text-muted-foreground tabular-nums">({l.points})</span>
                    {l.description ? <span className="block text-xs text-muted-foreground">{l.description}</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssignmentPanel({ data, preview }: { data: AssignmentPanelData; preview: boolean }) {
  const latest = data.submissions[data.submissions.length - 1];
  const canSubmit = !preview && (!latest || data.allowResubmission);
  const [text, setText] = useState(latest?.text ?? "");
  const [files, setFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [editing, setEditing] = useState(!latest);

  return (
    <div className="grid gap-5">
      {data.rubric ? (
        <section className="grid gap-2" aria-labelledby="rubric-heading">
          <h3 id="rubric-heading" className="text-sm font-semibold">How it&apos;s graded ({data.maxScore} points)</h3>
          <RubricTable rubric={data.rubric} selected={data.grade?.rubric} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Worth {data.maxScore} points.</p>
      )}

      {data.grade && data.grade.score !== null ? (
        <section className="grid gap-1 rounded-lg border bg-muted/30 p-4" aria-labelledby="grade-heading">
          <h3 id="grade-heading" className="text-sm font-semibold">
            Grade: <span className="tabular-nums">{data.grade.score} / {data.grade.maxScore}</span>
          </h3>
          {data.grade.feedback ? <p className="whitespace-pre-line text-sm">{data.grade.feedback}</p> : null}
        </section>
      ) : latest ? (
        <p className="text-sm text-muted-foreground">Submitted. Waiting for your teacher to grade it.</p>
      ) : null}

      {data.submissions.length ? (
        <section className="grid gap-2" aria-labelledby="history-heading">
          <h3 id="history-heading" className="text-sm font-semibold">Your submission{data.submissions.length > 1 ? "s" : ""}</h3>
          <ul className="grid gap-2">
            {[...data.submissions].reverse().map((s) => (
              <li key={s.id} className="rounded-md border p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">
                  #{s.number} · {s.submittedLabel}
                  {s.late ? <Badge variant="secondary" className="ml-2 bg-amber-500/15 text-amber-800">Late</Badge> : null}
                </p>
                {s.text ? <p className="whitespace-pre-line">{s.text}</p> : null}
                {s.files.map((f) => (
                  <a key={f.id} href={`/api/files/${f.id}?download=1`} className="mt-1 flex items-center gap-2 underline underline-offset-4">
                    <FileText className="size-4" aria-hidden /> {f.name} <span className="text-xs text-muted-foreground no-underline">{formatBytes(f.size)}</span>
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {preview ? (
        <p className="text-sm text-muted-foreground">Students submit their work here.</p>
      ) : canSubmit && !editing ? (
        <div>
          <Button variant="outline" onClick={() => setEditing(true)}>Submit a new version</Button>
        </div>
      ) : canSubmit ? (
        <section className="grid gap-3" aria-labelledby="submit-heading">
          <h3 id="submit-heading" className="text-sm font-semibold">{latest ? "New version" : "Your work"}</h3>
          {data.allowText ? (
            <>
              <label htmlFor="submission-text" className="sr-only">Your answer</label>
              <Textarea id="submission-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your answer…" />
            </>
          ) : null}
          {data.allowFiles ? (
            <div className="grid gap-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0" aria-hidden /><span className="truncate">{f.name}</span></span>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x.id !== f.id))}><Trash2 /></Button>
                </div>
              ))}
              {files.length < data.maxFiles ? (
                <FilePicker kind="submission" label="Attach file" multiple onUploaded={(f) => setFiles((prev) => [...prev, { id: f.id, name: f.name, size: f.size }])} />
              ) : null}
            </div>
          ) : null}
          <div>
            <ConfirmButton
              variant="default"
              disabled={!text.trim() && !files.length}
              run={async () => {
                const res = await submitAssignment({ classId: data.classId, entryId: data.entryId, text, fileIds: files.map((f) => f.id) });
                if (res.status === "success") {
                  setFiles([]);
                  setEditing(false);
                }
                return res;
              }}
              label={<><Send /> Submit</>}
              title="Submit your work?"
              description={data.allowResubmission ? "You can submit a new version later." : "You can't change it after submitting."}
              confirmLabel="Submit"
            />
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Resubmitting isn&apos;t allowed for this assignment.</p>
      )}
    </div>
  );
}
