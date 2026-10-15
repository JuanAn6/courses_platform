/**
 * Question types (pure): authoring schemas, response schemas, auto-grading, the student view
 * (answers stripped) and human-readable correct answers. Used by the bank, quizzes and grading.
 */
import { z } from "zod";

export const QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "NUMERIC",
  "MATCHING",
  "ORDERING",
  "FILL_BLANKS",
  "ESSAY",
  "FILE_UPLOAD",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_INFO: Record<QuestionType, { label: string; manual: boolean }> = {
  SINGLE_CHOICE: { label: "Single choice", manual: false },
  MULTIPLE_CHOICE: { label: "Multiple choice", manual: false },
  TRUE_FALSE: { label: "True / false", manual: false },
  SHORT_ANSWER: { label: "Short answer", manual: false },
  NUMERIC: { label: "Numeric", manual: false },
  MATCHING: { label: "Matching", manual: false },
  ORDERING: { label: "Ordering", manual: false },
  FILL_BLANKS: { label: "Fill in the blanks", manual: false },
  ESSAY: { label: "Essay", manual: true },
  FILE_UPLOAD: { label: "File upload", manual: true },
};

const id = z.string().trim().min(1).max(40);
const option = z.object({ id, text: z.string().trim().min(1, "Options can't be empty").max(1000) });
const uniqueIds = (items: { id: string }[]) => new Set(items.map((i) => i.id)).size === items.length;

// ───────────── Fill in the blanks: "The capital of France is [[Paris|paris]]." ─────────────

const BLANK = /\[\[([^\]]+)\]\]/g;

export function parseBlanks(text: string): { parts: (string | { blank: number })[]; answers: string[][] } {
  const parts: (string | { blank: number })[] = [];
  const answers: string[][] = [];
  let last = 0;
  for (const m of text.matchAll(BLANK)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ blank: answers.length });
    answers.push(m[1].split("|").map((a) => a.trim()).filter(Boolean));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return { parts, answers };
}

function compiles(pattern: string) {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export const questionDataSchemas = {
  SINGLE_CHOICE: z
    .object({ options: z.array(option).min(2, "Add at least two options").max(12), correct: id })
    .refine((d) => uniqueIds(d.options), "Option ids must be unique")
    .refine((d) => d.options.some((o) => o.id === d.correct), { message: "Choose the correct option", path: ["correct"] }),
  MULTIPLE_CHOICE: z
    .object({
      options: z.array(option).min(2, "Add at least two options").max(12),
      correct: z.array(id).min(1, "Mark at least one correct option"),
      partialCredit: z.boolean().default(true),
    })
    .refine((d) => uniqueIds(d.options), "Option ids must be unique")
    .refine((d) => d.correct.every((c) => d.options.some((o) => o.id === c)), { message: "Correct options must exist", path: ["correct"] }),
  TRUE_FALSE: z.object({ correct: z.boolean() }),
  SHORT_ANSWER: z.object({
    accepted: z.array(z.string().trim().min(1).max(200)).min(1, "Add at least one accepted answer").max(20),
    caseSensitive: z.boolean().default(false),
    /** Optional regular expressions, matched against the whole trimmed answer. */
    patterns: z
      .array(z.string().min(1).max(200).refine(compiles, "Invalid pattern"))
      .max(5)
      .default([]),
  }),
  NUMERIC: z.object({ answer: z.number().finite(), tolerance: z.number().min(0).max(1e9).default(0) }),
  MATCHING: z
    .object({
      pairs: z
        .array(z.object({ id, left: z.string().trim().min(1).max(500), right: z.string().trim().min(1).max(500) }))
        .min(2, "Add at least two pairs")
        .max(12),
      partialCredit: z.boolean().default(true),
    })
    .refine((d) => uniqueIds(d.pairs), "Pair ids must be unique"),
  ORDERING: z
    .object({ items: z.array(option).min(2, "Add at least two items").max(12), partialCredit: z.boolean().default(true) })
    .refine((d) => uniqueIds(d.items), "Item ids must be unique"),
  FILL_BLANKS: z
    .object({ text: z.string().trim().min(1).max(5000), caseSensitive: z.boolean().default(false) })
    .refine((d) => {
      const { answers } = parseBlanks(d.text);
      return answers.length > 0 && answers.every((a) => a.length > 0);
    }, { message: "Mark each blank like [[answer]] (alternatives: [[color|colour]])", path: ["text"] }),
  ESSAY: z
    .object({ minWords: z.number().int().min(0).max(10_000).nullish(), maxWords: z.number().int().min(1).max(20_000).nullish() })
    .refine((d) => !d.minWords || !d.maxWords || d.maxWords >= d.minWords, "The maximum must be at least the minimum"),
  FILE_UPLOAD: z.object({ maxFiles: z.number().int().min(1).max(5).default(1) }),
} satisfies Record<QuestionType, z.ZodType>;

export type QuestionData<T extends QuestionType> = z.output<(typeof questionDataSchemas)[T]>;

export const responseSchemas = {
  SINGLE_CHOICE: z.object({ choice: z.string().max(40).nullable() }),
  MULTIPLE_CHOICE: z.object({ choices: z.array(z.string().max(40)).max(12) }),
  TRUE_FALSE: z.object({ value: z.boolean().nullable() }),
  SHORT_ANSWER: z.object({ text: z.string().max(500) }),
  NUMERIC: z.object({ value: z.string().max(50) }),
  MATCHING: z.object({ matches: z.record(z.string().max(40), z.string().max(40)) }),
  ORDERING: z.object({ order: z.array(z.string().max(40)).max(12) }),
  FILL_BLANKS: z.object({ blanks: z.array(z.string().max(200)).max(50) }),
  ESSAY: z.object({ text: z.string().max(50_000) }),
  FILE_UPLOAD: z.object({ fileIds: z.array(z.string().max(40)).max(5) }),
} satisfies Record<QuestionType, z.ZodType>;

export type QuestionResponse<T extends QuestionType> = z.output<(typeof responseSchemas)[T]>;

export function emptyResponse(type: QuestionType): unknown {
  switch (type) {
    case "SINGLE_CHOICE":
      return { choice: null };
    case "MULTIPLE_CHOICE":
      return { choices: [] };
    case "TRUE_FALSE":
      return { value: null };
    case "SHORT_ANSWER":
    case "ESSAY":
      return { text: "" };
    case "NUMERIC":
      return { value: "" };
    case "MATCHING":
      return { matches: {} };
    case "ORDERING":
      return { order: [] };
    case "FILL_BLANKS":
      return { blanks: [] };
    case "FILE_UPLOAD":
      return { fileIds: [] };
  }
}

// ───────────── Grading ─────────────

const normalize = (s: string, caseSensitive: boolean) => {
  const t = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLocaleLowerCase();
};

export function parseNumber(value: string): number | null {
  const t = value.trim().replace(/\s/g, "");
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)(e[+-]?\d+)?$/i.test(t)) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Fraction of credit (0–1) for a response, or null when the type is graded by a teacher.
 * Invalid or missing responses score 0.
 */
export function gradeResponse(type: QuestionType, rawData: unknown, rawResponse: unknown): number | null {
  if (QUESTION_TYPE_INFO[type].manual) return null;
  const data = questionDataSchemas[type].parse(rawData) as Record<string, unknown>;
  const parsed = responseSchemas[type].safeParse(rawResponse);
  if (!parsed.success) return 0;
  const r = parsed.data as Record<string, unknown>;

  switch (type) {
    case "SINGLE_CHOICE":
      return r.choice === data.correct ? 1 : 0;
    case "TRUE_FALSE":
      return r.value === data.correct ? 1 : 0;
    case "MULTIPLE_CHOICE": {
      const correct = new Set(data.correct as string[]);
      const chosen = new Set(r.choices as string[]);
      const allIds = (data.options as { id: string }[]).map((o) => o.id);
      if (!data.partialCredit) return [...allIds].every((o) => correct.has(o) === chosen.has(o)) ? 1 : 0;
      // Each right pick earns 1/|correct|, each wrong pick costs the same; never below zero.
      const hits = [...chosen].filter((c) => correct.has(c)).length;
      const misses = [...chosen].filter((c) => !correct.has(c)).length;
      return Math.max(0, (hits - misses) / correct.size);
    }
    case "SHORT_ANSWER": {
      const caseSensitive = data.caseSensitive as boolean;
      const answer = normalize(r.text as string, caseSensitive);
      if (!answer) return 0;
      if ((data.accepted as string[]).some((a) => normalize(a, caseSensitive) === answer)) return 1;
      const text = (r.text as string).trim();
      return (data.patterns as string[]).some((p) => new RegExp(`^(?:${p})$`, caseSensitive ? "" : "i").test(text)) ? 1 : 0;
    }
    case "NUMERIC": {
      const n = parseNumber(r.value as string);
      if (n === null) return 0;
      return Math.abs(n - (data.answer as number)) <= (data.tolerance as number) + 1e-12 ? 1 : 0;
    }
    case "MATCHING": {
      const pairs = data.pairs as { id: string }[];
      const matches = r.matches as Record<string, string>;
      const right = pairs.filter((p) => matches[p.id] === p.id).length;
      return data.partialCredit ? right / pairs.length : right === pairs.length ? 1 : 0;
    }
    case "ORDERING": {
      const items = (data.items as { id: string }[]).map((i) => i.id);
      const order = r.order as string[];
      const inPlace = items.filter((itemId, i) => order[i] === itemId).length;
      return data.partialCredit ? inPlace / items.length : inPlace === items.length ? 1 : 0;
    }
    case "FILL_BLANKS": {
      const { answers } = parseBlanks(data.text as string);
      const caseSensitive = data.caseSensitive as boolean;
      const blanks = r.blanks as string[];
      const right = answers.filter((accepted, i) => accepted.some((a) => normalize(a, caseSensitive) === normalize(blanks[i] ?? "", caseSensitive))).length;
      return right / answers.length;
    }
    default:
      return null;
  }
}

export const roundScore = (n: number) => Math.round(n * 100) / 100;

// ───────────── Student view ─────────────

/** Deterministic PRNG so a student's shuffle survives reloads (seeded per attempt and question). */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type StudentQuestionView =
  | { type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; options: { id: string; text: string }[] }
  | { type: "TRUE_FALSE" }
  | { type: "SHORT_ANSWER" | "NUMERIC" }
  | { type: "MATCHING"; left: { id: string; text: string }[]; right: { id: string; text: string }[] }
  | { type: "ORDERING"; items: { id: string; text: string }[] }
  | { type: "FILL_BLANKS"; parts: (string | { blank: number })[]; blankCount: number }
  | { type: "ESSAY"; minWords: number | null; maxWords: number | null }
  | { type: "FILE_UPLOAD"; maxFiles: number };

/** What a student may see while answering: never the correct answers. */
export function studentView(type: QuestionType, rawData: unknown, seed: string, shuffleOptions: boolean): StudentQuestionView {
  const data = questionDataSchemas[type].parse(rawData) as Record<string, unknown>;
  switch (type) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE": {
      const options = data.options as { id: string; text: string }[];
      return { type, options: shuffleOptions ? seededShuffle(options, seed) : options };
    }
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC":
      return { type };
    case "MATCHING": {
      const pairs = data.pairs as { id: string; left: string; right: string }[];
      return {
        type,
        left: pairs.map((p) => ({ id: p.id, text: p.left })),
        right: seededShuffle(pairs.map((p) => ({ id: p.id, text: p.right })), `${seed}:right`),
      };
    }
    case "ORDERING": {
      const items = data.items as { id: string; text: string }[];
      let shuffled = seededShuffle(items, seed);
      // Never show the answer as the starting order.
      if (shuffled.every((it, i) => it.id === items[i].id)) shuffled = [...shuffled.slice(1), shuffled[0]];
      return { type, items: shuffled };
    }
    case "FILL_BLANKS": {
      const { parts, answers } = parseBlanks(data.text as string);
      return { type, parts, blankCount: answers.length };
    }
    case "ESSAY":
      return { type, minWords: (data.minWords as number | null) ?? null, maxWords: (data.maxWords as number | null) ?? null };
    case "FILE_UPLOAD":
      return { type, maxFiles: data.maxFiles as number };
  }
}

/** Human-readable correct answer, shown in results when the quiz allows it. */
export function correctAnswerText(type: QuestionType, rawData: unknown): string | null {
  const data = questionDataSchemas[type].parse(rawData) as Record<string, unknown>;
  const optionText = (ids: string[]) =>
    (data.options as { id: string; text: string }[]).filter((o) => ids.includes(o.id)).map((o) => o.text).join(", ");
  switch (type) {
    case "SINGLE_CHOICE":
      return optionText([data.correct as string]);
    case "MULTIPLE_CHOICE":
      return optionText(data.correct as string[]);
    case "TRUE_FALSE":
      return data.correct ? "True" : "False";
    case "SHORT_ANSWER":
      return (data.accepted as string[]).join(" / ");
    case "NUMERIC":
      return data.tolerance ? `${data.answer} (± ${data.tolerance})` : String(data.answer);
    case "MATCHING":
      return (data.pairs as { left: string; right: string }[]).map((p) => `${p.left} → ${p.right}`).join("; ");
    case "ORDERING":
      return (data.items as { text: string }[]).map((i) => i.text).join(" → ");
    case "FILL_BLANKS":
      return parseBlanks(data.text as string).answers.map((a, i) => `${i + 1}. ${a.join(" / ")}`).join("  ");
    default:
      return null;
  }
}
