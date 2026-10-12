import Papa from "papaparse";
import { z } from "zod";
import { emailField, optionalText } from "@/lib/zod";
import { studentFields } from "./schemas";

/** Columns accepted by the student import (header names are case-insensitive). */
export const STUDENT_IMPORT_COLUMNS = [
  "name",
  "email",
  "phone",
  "studentCode",
  "birthDate",
  "documentId",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "medicalNotes",
  "enrollmentDate",
  "status",
  "guardianName",
  "guardianEmail",
  "guardianPhone",
  "guardianRelationship",
] as const;

export const REQUIRED_IMPORT_COLUMNS = ["name", "email"] as const;
export const MAX_IMPORT_ROWS = 2000;

const guardianFields = z
  .object({
    guardianName: optionalText(100),
    guardianEmail: z.union([z.literal(""), emailField()]).optional().transform((v) => v || null),
    guardianPhone: optionalText(30),
    guardianRelationship: optionalText(50),
  })
  .superRefine((g, ctx) => {
    if (g.guardianName && !g.guardianEmail) {
      ctx.addIssue({ code: "custom", path: ["guardianEmail"], message: "Guardian email is required with a guardian name" });
    }
  });

export const studentImportRowSchema = z.object(studentFields).and(guardianFields);
export type StudentImportRow = z.output<typeof studentImportRowSchema>;

export type ParsedImportRow = { line: number; data: StudentImportRow | null; errors: string[] };

const COLUMN_LOOKUP = new Map(STUDENT_IMPORT_COLUMNS.map((c) => [c.toLowerCase(), c]));

/** Parses and validates CSV text. DB checks (existing emails/codes) happen on the server afterwards. */
export function parseStudentCsv(text: string): { rows: ParsedImportRow[]; fileErrors: string[] } {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => COLUMN_LOOKUP.get(h.trim().replace(/[\s_]/g, "").toLowerCase()) ?? `?${h.trim()}`,
  });

  const fileErrors: string[] = [];
  const headers = result.meta.fields ?? [];
  const unknown = headers.filter((h) => h.startsWith("?")).map((h) => h.slice(1));
  if (unknown.length) fileErrors.push(`Unknown columns: ${unknown.join(", ")}`);
  const missing = REQUIRED_IMPORT_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) fileErrors.push(`Missing required columns: ${missing.join(", ")}`);
  if (result.data.length > MAX_IMPORT_ROWS) fileErrors.push(`Too many rows (max ${MAX_IMPORT_ROWS}).`);
  if (result.data.length === 0) fileErrors.push("The file has no data rows.");
  if (fileErrors.length) return { rows: [], fileErrors };

  const seenEmails = new Map<string, number>();
  const seenCodes = new Map<string, number>();

  const rows = result.data.map((raw, i): ParsedImportRow => {
    const line = i + 2; // header is line 1
    const parsed = studentImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        line,
        data: null,
        errors: parsed.error.issues.map((issue) => `${String(issue.path[0] ?? "row")}: ${issue.message}`),
      };
    }
    const errors: string[] = [];
    const { email, studentCode } = parsed.data;
    if (seenEmails.has(email)) errors.push(`email: duplicate of line ${seenEmails.get(email)}`);
    else seenEmails.set(email, line);
    if (studentCode) {
      if (seenCodes.has(studentCode)) errors.push(`studentCode: duplicate of line ${seenCodes.get(studentCode)}`);
      else seenCodes.set(studentCode, line);
    }
    if (parsed.data.guardianEmail === email) errors.push("guardianEmail: must differ from the student's email");
    return { line, data: errors.length ? null : parsed.data, errors };
  });

  return { rows, fileErrors };
}

/** Neutralizes spreadsheet formulas (CSV injection) while leaving phone-like values alone. */
export function csvSafe(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().-]*$/.test(s))) return `'${s}`;
  return s;
}

export function toCsv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  const data = rows.map((r) => columns.map((c) => csvSafe(r[c])));
  return Papa.unparse({ fields: [...columns], data }, { newline: "\r\n" });
}

/** Example file offered on the import page. */
export const STUDENT_IMPORT_TEMPLATE = toCsv(STUDENT_IMPORT_COLUMNS, [
  {
    name: "Ana Pérez",
    email: "ana.perez@example.com",
    phone: "+57 300 000 0000",
    studentCode: "",
    birthDate: "2012-05-14",
    documentId: "1234567890",
    address: "Calle 1 # 2-3",
    emergencyContactName: "Luis Pérez",
    emergencyContactPhone: "+57 300 000 0001",
    medicalNotes: "",
    enrollmentDate: "",
    status: "ACTIVE",
    guardianName: "Luis Pérez",
    guardianEmail: "luis.perez@example.com",
    guardianPhone: "+57 300 000 0001",
    guardianRelationship: "Father",
  },
]);

/** Columns for the full-directory export (medical notes are deliberately excluded). */
export const STUDENT_EXPORT_COLUMNS = [
  "studentCode",
  "name",
  "email",
  "phone",
  "status",
  "birthDate",
  "documentId",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "enrollmentDate",
  "accountStatus",
  "guardians",
] as const;

