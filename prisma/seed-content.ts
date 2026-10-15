/** Demo course content for the seed: text, video link, PDF handout, slides, link and embed. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient, QuestionType } from "../src/generated/prisma/client";

/** A tiny, valid multi-page PDF with one line of text per page (no dependencies). */
export function makePdf(pages: { title: string; lines: string[] }[]): Buffer {
  const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const objects: string[] = [];
  const pageIds: number[] = [];
  objects[1] = ""; // catalog, filled below
  objects[2] = ""; // pages
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (const page of pages) {
    const body = [
      "BT /F1 28 Tf 60 520 Td (" + escape(page.title) + ") Tj ET",
      ...page.lines.map((line, i) => `BT /F1 16 Tf 60 ${470 - i * 28} Td (${escape(line)}) Tj ET`),
    ].join("\n");
    const contentId = objects.length;
    objects[contentId] = `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`;
    const pageId = objects.length;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
  }
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(out);
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const text = (s: string) => ({ type: "text", text: s });
const para = (...c: Prisma.InputJsonValue[]) => ({ type: "paragraph", content: c });
const heading = (s: string) => ({ type: "heading", attrs: { level: 2 }, content: [text(s)] });
const bullets = (...items: string[]) => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [para(text(i))] })),
});

async function storeFile(db: PrismaClient, ownerId: string, name: string, data: Buffer) {
  const key = `seed/${name}`;
  const root = path.resolve(process.env.STORAGE_DIR ?? "./storage");
  await mkdir(path.join(root, "seed"), { recursive: true });
  await writeFile(path.join(root, key), data);
  const existing = await db.file.findUnique({ where: { storageKey: key } });
  if (existing) return existing;
  return db.file.create({ data: { storageKey: key, originalName: name, mime: "application/pdf", size: data.byteLength, ownerId } });
}

type EntrySeed = {
  type: "TEXT" | "VIDEO" | "DOCUMENT" | "PRESENTATION" | "LINK" | "EMBED";
  title: string;
  content: Prisma.InputJsonValue;
  required?: boolean;
  fileIds?: string[];
};

async function addUnit(
  db: PrismaClient,
  courseId: string,
  position: number,
  title: string,
  description: string,
  entries: EntrySeed[],
  prerequisiteUnitId?: string,
) {
  const unit = await db.unit.create({ data: { courseId, title, description, position, prerequisiteUnitId } });
  for (const [i, e] of entries.entries()) {
    const entry = await db.entry.create({
      data: { unitId: unit.id, type: e.type, title: e.title, position: i, status: "PUBLISHED", required: e.required ?? true, content: e.content },
    });
    if (e.fileIds?.length) await db.entryFile.createMany({ data: e.fileIds.map((fileId) => ({ entryId: entry.id, fileId })) });
  }
  return unit;
}

/** Adds content to the demo courses once (skips courses that already have units). */
export async function seedContent(db: PrismaClient, opts: { algebraId: string; spanishId: string; teacherId: string }) {
  if (!(await db.unit.count({ where: { courseId: opts.algebraId } }))) {
    const handout = await storeFile(
      db,
      opts.teacherId,
      "algebra-cheat-sheet.pdf",
      makePdf([{ title: "Algebra cheat sheet", lines: ["a + b = b + a", "a(b + c) = ab + ac", "If ax + b = c, then x = (c - b) / a"] }]),
    );
    const slides = await storeFile(
      db,
      opts.teacherId,
      "functions-slides.pdf",
      makePdf([
        { title: "Functions", lines: ["A function maps each input to exactly one output."] },
        { title: "Notation", lines: ["f(x) = 2x + 1", "f(3) = 7"] },
        { title: "Graphs", lines: ["Plot the pairs (x, f(x)).", "A line means the function is linear."] },
      ]),
    );
    const unit1 = await addUnit(db, opts.algebraId, 0, "Unit 1: Expressions and equations", "Simplify expressions and solve linear equations.", [
      {
        type: "TEXT",
        title: "What is an equation?",
        content: {
          doc: {
            type: "doc",
            content: [
              heading("Balancing both sides"),
              para(text("An equation says two expressions are "), { type: "text", text: "equal", marks: [{ type: "bold" }] }, text(".")),
              para(text("To solve it, do the same operation on both sides until the variable is alone:")),
              bullets("Add or subtract the same number", "Multiply or divide by the same non-zero number"),
            ],
          },
        },
      },
      { type: "VIDEO", title: "Solving one-step equations", content: { source: "url", url: "https://www.youtube.com/watch?v=l3XzepN03KQ", completionPercent: 90 } },
      { type: "DOCUMENT", title: "Cheat sheet", content: { fileIds: [handout.id] }, fileIds: [handout.id] },
      { type: "LINK", title: "Extra practice on Khan Academy", content: { url: "https://www.khanacademy.org/math/algebra" }, required: false },
    ]);
    await addUnit(
      db,
      opts.algebraId,
      1,
      "Unit 2: Functions",
      "Read, write and graph functions.",
      [
        { type: "PRESENTATION", title: "Introduction to functions", content: { source: "file", fileId: slides.id }, fileIds: [slides.id] },
        {
          type: "TEXT",
          title: "Function notation",
          content: { doc: { type: "doc", content: [para(text("We write f(x) for the output of f when the input is x."))] } },
        },
      ],
      unit1.id,
    );
  }

  if (!(await db.unit.count({ where: { courseId: opts.spanishId } }))) {
    await addUnit(db, opts.spanishId, 0, "Unidad 1: Saludos", "Greetings and introductions.", [
      {
        type: "TEXT",
        title: "Hola y adiós",
        content: { doc: { type: "doc", content: [heading("Common greetings"), bullets("Hola: hello", "Buenos días: good morning", "Adiós: goodbye")] } },
      },
      { type: "EMBED", title: "Pronunciation video", content: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", height: 480 } },
    ]);
  }
}

type QuestionSeed = { type: QuestionType; text: string; data: Prisma.InputJsonValue; points?: number; tags: string; explanation?: string };

/** A small Algebra question bank, a quiz, a timed quiz and an assignment (once). */
export async function seedAssessments(db: PrismaClient, opts: { algebraId: string; teacherId: string }) {
  if (await db.question.count({ where: { courseId: opts.algebraId } })) return;
  const prompt = (s: string) => ({ type: "doc", content: [para(text(s))] });
  const questions: QuestionSeed[] = [
    { type: "SINGLE_CHOICE", text: "Solve: x + 3 = 7", tags: ",unit-1,speed,", data: { options: [{ id: "a", text: "x = 3" }, { id: "b", text: "x = 4" }, { id: "c", text: "x = 10" }, { id: "d", text: "x = 21" }], correct: "b" }, explanation: "Subtract 3 from both sides: x = 7 - 3 = 4." },
    { type: "TRUE_FALSE", text: "2(x + 1) = 2x + 2 for every value of x.", tags: ",unit-1,", data: { correct: true } },
    { type: "NUMERIC", text: "Solve 3x = 12. What is x?", tags: ",unit-1,speed,", data: { answer: 4, tolerance: 0 } },
    { type: "SHORT_ANSWER", text: "What do we call the letter x in 3x + 2 = 8?", tags: ",unit-1,", data: { accepted: ["variable", "a variable", "unknown"], caseSensitive: false, patterns: [] } },
    { type: "MULTIPLE_CHOICE", text: "Which of these are equations?", points: 2, tags: ",unit-1,", data: { options: [{ id: "a", text: "x + 1 = 5" }, { id: "b", text: "3 + 4" }, { id: "c", text: "2y = 10" }, { id: "d", text: "7 > 2" }], correct: ["a", "c"], partialCredit: true } },
    { type: "FILL_BLANKS", text: "Complete the steps.", points: 2, tags: ",unit-1,", data: { text: "To solve x - 5 = 2, add [[5|five]] to both sides, so x = [[7|seven]].", caseSensitive: false } },
    { type: "MATCHING", text: "Match each equation with its solution.", tags: ",unit-1,", data: { pairs: [{ id: "p1", left: "x + 2 = 5", right: "x = 3" }, { id: "p2", left: "2x = 8", right: "x = 4" }, { id: "p3", left: "x - 1 = 9", right: "x = 10" }], partialCredit: true } },
    { type: "ORDERING", text: "Put the steps for solving 2x + 3 = 11 in order.", tags: ",unit-1,", data: { items: [{ id: "s1", text: "Subtract 3 from both sides" }, { id: "s2", text: "Get 2x = 8" }, { id: "s3", text: "Divide both sides by 2" }, { id: "s4", text: "x = 4" }], partialCredit: true } },
    { type: "ESSAY", text: "Explain in your own words why we do the same thing to both sides of an equation.", points: 3, tags: ",unit-1,", data: { minWords: 10, maxWords: 200 } },
  ];
  const ids: string[] = [];
  for (const q of questions) {
    const created = await db.question.create({
      data: {
        courseId: opts.algebraId,
        type: q.type,
        prompt: prompt(q.text),
        data: q.data,
        points: q.points ?? 1,
        tags: q.tags,
        explanation: q.explanation ?? null,
        createdById: opts.teacherId,
      },
    });
    ids.push(created.id);
  }

  const unit = await db.unit.create({
    data: { courseId: opts.algebraId, title: "Unit 3: Check your understanding", description: "Quizzes and an assignment for Units 1 and 2.", position: 2 },
  });
  const quizSettings = (over: Record<string, unknown>) => ({
    timeLimitMin: null, maxAttempts: 1, scoring: "highest", shuffleQuestions: false, shuffleOptions: true,
    showResults: "after_submit", showCorrectAnswers: true, passingPercent: null, lockAfterDue: false, onePerPage: false, ...over,
  });
  await db.entry.create({
    data: {
      unitId: unit.id, type: "QUIZ", title: "Unit 1 quiz", position: 0, status: "PUBLISHED", createdById: opts.teacherId,
      content: { settings: quizSettings({ timeLimitMin: 20, maxAttempts: 2, passingPercent: 60 }), items: ids.map((questionId) => ({ kind: "question", questionId, points: null })) },
    },
  });
  await db.entry.create({
    data: {
      unitId: unit.id, type: "QUIZ", title: "Speed check", position: 1, status: "PUBLISHED", required: false, createdById: opts.teacherId,
      content: { settings: quizSettings({ timeLimitMin: 1, maxAttempts: 0 }), items: [{ kind: "random", tag: "speed", count: 2, points: null }] },
    },
  });
  await db.entry.create({
    data: {
      unitId: unit.id, type: "ASSIGNMENT", title: "Word problems", position: 2, status: "PUBLISHED", createdById: opts.teacherId,
      content: {
        instructions: { type: "doc", content: [para(text("Write and solve an equation for each problem. Show your steps.")), bullets("Ana has 3 more apples than Ben, who has 5.", "A ticket costs $4. How many can you buy with $28?")] },
        allowText: true, allowFiles: true, maxFiles: 3, allowResubmission: true, points: 10,
        rubric: {
          criteria: [
            { id: "c1", title: "Equations", description: "", levels: [{ id: "c1a", label: "Missing", points: 0, description: "" }, { id: "c1b", label: "Partly correct", points: 3, description: "" }, { id: "c1c", label: "Correct", points: 5, description: "" }] },
            { id: "c2", title: "Steps shown", description: "", levels: [{ id: "c2a", label: "None", points: 0, description: "" }, { id: "c2b", label: "Some", points: 2, description: "" }, { id: "c2c", label: "All", points: 5, description: "" }] },
          ],
        },
      },
    },
  });
}
