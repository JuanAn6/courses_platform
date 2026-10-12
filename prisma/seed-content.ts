/** Demo course content for the seed: text, video link, PDF handout, slides, link and embed. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";

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
