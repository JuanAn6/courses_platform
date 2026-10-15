/** Quiz rules (pure): settings, item resolution, deadlines, attempt limits, scoring policies, result visibility. */
import { z } from "zod";
import { seededShuffle } from "./questions";

export const SCORING_POLICIES = ["highest", "last", "average"] as const;
export const RESULT_POLICIES = ["after_submit", "after_due", "never"] as const;

export const quizSettingsSchema = z.object({
  /** Minutes; null = untimed. */
  timeLimitMin: z.number().int().min(1).max(600).nullable().default(null),
  /** 0 = unlimited. */
  maxAttempts: z.number().int().min(0).max(50).default(1),
  scoring: z.enum(SCORING_POLICIES).default("highest"),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
  showResults: z.enum(RESULT_POLICIES).default("after_submit"),
  showCorrectAnswers: z.boolean().default(true),
  /** Percentage needed to pass; null = no pass mark. */
  passingPercent: z.number().int().min(0).max(100).nullable().default(null),
  /** No new attempts after the due date (in-progress attempts end at the due date). */
  lockAfterDue: z.boolean().default(false),
  onePerPage: z.boolean().default(false),
});
export type QuizSettings = z.output<typeof quizSettingsSchema>;

export const quizItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("question"),
    questionId: z.string().min(1),
    /** Overrides the question's default points. */
    points: z.number().min(0).max(1000).nullable().default(null),
  }),
  z.object({
    kind: z.literal("random"),
    tag: z.string().trim().min(1).max(40),
    count: z.number().int().min(1).max(50),
    points: z.number().min(0).max(1000).nullable().default(null),
  }),
]);
export type QuizItem = z.output<typeof quizItemSchema>;

export type BankQuestion = { id: string; tags: string[]; points: number };
export type ResolvedItem = { questionId: string; points: number };

/**
 * Turns quiz items into concrete questions for one attempt. Random picks draw (seeded) from
 * questions with the tag, never repeating a question already in the quiz.
 * `missing` reports items that couldn't be filled (deleted question, too few tagged questions).
 */
export function resolveItems(items: QuizItem[], bank: BankQuestion[], seed: string, shuffle: boolean) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const used = new Set(items.flatMap((i) => (i.kind === "question" ? [i.questionId] : [])));
  const out: ResolvedItem[] = [];
  const missing: string[] = [];

  items.forEach((item, index) => {
    if (item.kind === "question") {
      const q = byId.get(item.questionId);
      if (q) out.push({ questionId: q.id, points: item.points ?? q.points });
      else missing.push(`Item ${index + 1}: question no longer exists`);
      return;
    }
    const pool = seededShuffle(
      bank.filter((q) => q.tags.includes(item.tag) && !used.has(q.id)),
      `${seed}:${index}`,
    );
    const picked = pool.slice(0, item.count);
    if (picked.length < item.count) missing.push(`Item ${index + 1}: only ${picked.length} of ${item.count} questions tagged “${item.tag}”`);
    for (const q of picked) {
      used.add(q.id);
      out.push({ questionId: q.id, points: item.points ?? q.points });
    }
  });

  return { items: shuffle ? seededShuffle(out, `${seed}:order`) : out, missing };
}

/** When an attempt must be submitted: the time limit and/or the due date (if locked after it). */
export function attemptDeadline(startedAt: Date, settings: QuizSettings, dueAt: Date | null): Date | null {
  const candidates: Date[] = [];
  if (settings.timeLimitMin) candidates.push(new Date(startedAt.getTime() + settings.timeLimitMin * 60_000));
  if (settings.lockAfterDue && dueAt) candidates.push(dueAt);
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

/** Answers saved within this many ms after the deadline are still accepted (network latency). */
export const DEADLINE_GRACE_MS = 30_000;

export function startRefusal(input: {
  settings: QuizSettings;
  attemptsUsed: number;
  dueAt: Date | null;
  now: Date;
  questionCount: number;
}): string | null {
  const { settings, attemptsUsed, dueAt, now } = input;
  if (input.questionCount === 0) return "This quiz has no questions yet.";
  if (settings.lockAfterDue && dueAt && now >= dueAt) return "This quiz closed on its due date.";
  if (settings.maxAttempts > 0 && attemptsUsed >= settings.maxAttempts) {
    return settings.maxAttempts === 1 ? "You've already taken this quiz." : `You've used all ${settings.maxAttempts} attempts.`;
  }
  return null;
}

/** Combines finished attempts (in order) into the grade, per the quiz's policy. */
export function aggregateScore(scores: number[], policy: QuizSettings["scoring"]): number | null {
  if (!scores.length) return null;
  if (policy === "last") return scores[scores.length - 1];
  if (policy === "average") return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  return Math.max(...scores);
}

export function canSeeResults(settings: QuizSettings, dueAt: Date | null, now: Date): boolean {
  if (settings.showResults === "never") return false;
  if (settings.showResults === "after_due") return !dueAt || now >= dueAt;
  return true;
}

export function passed(score: number | null, max: number, settings: QuizSettings): boolean | null {
  if (settings.passingPercent === null || score === null || max <= 0) return null;
  return (score / max) * 100 >= settings.passingPercent;
}
