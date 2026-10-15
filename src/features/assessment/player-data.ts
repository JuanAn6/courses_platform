import "server-only";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { assignmentMaxScore, parseContent } from "@/features/entries/registry";
import type { AssignmentPanelData, QuizPanelData } from "./components/student-panels";
import { canSeeResults, startRefusal } from "./quiz";
import { attemptsFor, finalizeExpired, previewQuizItems } from "./quiz-service";

/** Everything the student's quiz panel shows. Submits expired attempts first. */
export async function quizPanelData(input: {
  classId: string;
  entryId: string;
  courseId: string;
  userId: string;
  content: unknown;
  dueAt: Date | null;
  timezone: string;
  now?: Date;
}): Promise<QuizPanelData> {
  const now = input.now ?? new Date();
  const { settings, items } = parseContent("QUIZ", input.content);
  await finalizeExpired({ entryId: input.entryId, classId: input.classId, userId: input.userId }, now);
  const [attempts, resolved, grade] = await Promise.all([
    attemptsFor(input.entryId, input.classId, input.userId),
    previewQuizItems(input.courseId, items),
    db.grade.findUnique({ where: { classId_userId_entryId: { classId: input.classId, userId: input.userId, entryId: input.entryId } } }),
  ]);
  const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
  return {
    kind: "quiz",
    classId: input.classId,
    entryId: input.entryId,
    questionCount: resolved.items.length,
    totalPoints: Math.round(resolved.items.reduce((s, i) => s + i.points, 0) * 100) / 100,
    timeLimitMin: settings.timeLimitMin,
    maxAttempts: settings.maxAttempts,
    scoring: settings.scoring,
    passingPercent: settings.passingPercent,
    attempts: attempts.map((a) => ({
      id: a.id,
      number: a.number,
      status: a.status,
      score: a.score,
      maxScore: a.maxScore,
      submittedLabel: a.submittedAt ? formatDateTime(a.submittedAt, input.timezone) : null,
    })),
    inProgressId: inProgress?.id ?? null,
    refusal: inProgress
      ? null
      : startRefusal({ settings, attemptsUsed: attempts.length, dueAt: input.dueAt, now, questionCount: resolved.items.length }),
    resultsVisible: canSeeResults(settings, input.dueAt, now),
    grade: grade ? { score: grade.score, maxScore: grade.maxScore } : null,
  };
}

export async function assignmentPanelData(input: {
  classId: string;
  entryId: string;
  userId: string;
  content: unknown;
  timezone: string;
}): Promise<AssignmentPanelData> {
  const c = parseContent("ASSIGNMENT", input.content);
  const [submissions, grade] = await Promise.all([
    db.submission.findMany({
      where: { entryId: input.entryId, classId: input.classId, userId: input.userId },
      orderBy: { number: "asc" },
      include: { files: { include: { file: { select: { id: true, originalName: true, size: true } } } } },
    }),
    db.grade.findUnique({ where: { classId_userId_entryId: { classId: input.classId, userId: input.userId, entryId: input.entryId } } }),
  ]);
  return {
    kind: "assignment",
    classId: input.classId,
    entryId: input.entryId,
    allowText: c.allowText,
    allowFiles: c.allowFiles,
    maxFiles: c.maxFiles,
    allowResubmission: c.allowResubmission,
    maxScore: assignmentMaxScore(input.content),
    rubric: c.rubric,
    submissions: submissions.map((s) => ({
      id: s.id,
      number: s.number,
      text: s.text,
      files: s.files.map((f) => ({ id: f.file.id, name: f.file.originalName, size: f.file.size })),
      submittedLabel: formatDateTime(s.submittedAt, input.timezone),
      late: s.late,
    })),
    // Students only see released grades.
    grade: grade?.released
      ? { score: grade.score, maxScore: grade.maxScore, feedback: grade.feedback, rubric: (grade.rubric as Record<string, string> | null) ?? null }
      : null,
  };
}
