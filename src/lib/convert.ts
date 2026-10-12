import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { env } from "@/env";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

/**
 * Office → PDF conversion with LibreOffice (headless), run in-process after the upload response.
 * Without a job queue (Redis), conversions run one at a time; a file stuck in PROCESSING
 * (e.g. after a restart) can be retried from the editor.
 */

const CANDIDATES = [
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  "/usr/bin/soffice",
  "/usr/lib/libreoffice/program/soffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

export function sofficePath(): string | null {
  if (env.SOFFICE_PATH) return env.SOFFICE_PATH;
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

export const CONVERTIBLE_MIMES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
]);

const EXTENSIONS: Record<string, string> = {
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.oasis.opendocument.presentation": ".odp",
};

let queue: Promise<unknown> = Promise.resolve();

/** Queues a conversion; resolves when it finishes (never rejects). */
export function enqueuePdfConversion(fileId: string) {
  const job = queue.then(() => convertToPdf(fileId)).catch((error) => console.error("[convert] failed", fileId, error));
  queue = job;
  return job;
}

async function convertToPdf(fileId: string) {
  const file = await db.file.findUnique({ where: { id: fileId } });
  if (!file || !CONVERTIBLE_MIMES.has(file.mime)) return;
  const binary = sofficePath();
  if (!binary) {
    await db.file.update({ where: { id: fileId }, data: { status: "FAILED", derived: { error: "LibreOffice is not installed on the server." } } });
    return;
  }

  const work = await mkdtemp(path.join(os.tmpdir(), "convert-"));
  try {
    const input = path.join(work, `input${EXTENSIONS[file.mime] ?? ""}`);
    await writeFile(input, await storage.get(file.storageKey));
    // A private profile per run lets conversions work even if LibreOffice is open on the desktop.
    const profile = pathToFileURL(path.join(work, "profile")).href;
    await new Promise<void>((resolve, reject) => {
      execFile(
        // The binary is outside the project: don't let output tracing follow it.
        /* turbopackIgnore: true */ binary,
        ["--headless", "--norestore", `-env:UserInstallation=${profile}`, "--convert-to", "pdf", "--outdir", work, input],
        { timeout: 180_000, windowsHide: true },
        (error) => (error ? reject(error) : resolve()),
      );
    });
    const pdf = await readFile(path.join(work, "input.pdf"));
    const pdfName = file.originalName.replace(/\.[^.]+$/, "") + ".pdf";
    const key = `${path.posix.dirname(file.storageKey)}/${crypto.randomUUID()}-${pdfName}`;
    await storage.put(key, pdf);
    await db.$transaction(async (tx) => {
      const rendition = await tx.file.create({
        data: { storageKey: key, originalName: pdfName, mime: "application/pdf", size: pdf.byteLength, ownerId: file.ownerId, sourceId: file.id },
      });
      await tx.file.update({ where: { id: file.id }, data: { status: "READY", derived: { pdfFileId: rendition.id } } });
    });
  } catch (error) {
    console.error("[convert] LibreOffice conversion failed", error);
    await db.file.update({
      where: { id: fileId },
      data: { status: "FAILED", derived: { error: "The file couldn't be converted. Try exporting it as PDF." } },
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
