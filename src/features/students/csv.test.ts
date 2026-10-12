import { describe, expect, it } from "vitest";
import { csvSafe, parseStudentCsv, STUDENT_IMPORT_TEMPLATE, toCsv } from "./csv";

describe("parseStudentCsv", () => {
  it("accepts the template file", () => {
    const { rows, fileErrors } = parseStudentCsv(STUDENT_IMPORT_TEMPLATE);
    expect(fileErrors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data).toMatchObject({
      name: "Ana Pérez",
      email: "ana.perez@example.com",
      status: "ACTIVE",
      guardianEmail: "luis.perez@example.com",
    });
    expect(rows[0].data?.birthDate).toEqual(new Date("2012-05-14T00:00:00Z"));
  });

  it("matches headers case-insensitively and ignores a BOM", () => {
    const { rows, fileErrors } = parseStudentCsv("﻿Name,EMAIL,Student Code\nAna,ANA@X.COM,s-1\n");
    expect(fileErrors).toEqual([]);
    expect(rows[0].data).toMatchObject({ name: "Ana", email: "ana@x.com", studentCode: "S-1" });
  });

  it("reports missing and unknown columns", () => {
    const { fileErrors } = parseStudentCsv("name,favoriteColor\nAna,blue\n");
    expect(fileErrors).toContain("Unknown columns: favoriteColor");
    expect(fileErrors).toContain("Missing required columns: email");
  });

  it("reports an empty file", () => {
    expect(parseStudentCsv("name,email\n").fileErrors).toContain("The file has no data rows.");
  });

  it("validates rows and reports line numbers", () => {
    const csv = [
      "name,email,birthDate,status,guardianName",
      "Ana,ana@x.com,2012-01-01,ACTIVE,",
      "B,not-an-email,13/01/2012,MAYBE,",
      "Carl,ana@x.com,,,",
      "Dana,dana@x.com,,,Dad",
    ].join("\n");
    const { rows } = parseStudentCsv(csv);
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors.join(" ")).toMatch(/name/);
    expect(rows[1].errors.join(" ")).toMatch(/email/);
    expect(rows[1].errors.join(" ")).toMatch(/birthDate/);
    expect(rows[1].errors.join(" ")).toMatch(/status/);
    expect(rows[2].errors).toEqual(["email: duplicate of line 2"]);
    expect(rows[3].errors.join(" ")).toMatch(/Guardian email is required/);
    expect(rows.filter((r) => r.data).length).toBe(1);
  });

  it("rejects a guardian with the student's own email", () => {
    const { rows } = parseStudentCsv("name,email,guardianName,guardianEmail\nAna,ana@x.com,Ana,ana@x.com\n");
    expect(rows[0].errors.join(" ")).toMatch(/must differ/);
  });
});

describe("CSV export safety", () => {
  it("neutralizes formulas but keeps phone numbers", () => {
    expect(csvSafe("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvSafe("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvSafe("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvSafe("+57 300 000 0000")).toBe("+57 300 000 0000");
    expect(csvSafe("-12.5")).toBe("-12.5");
    expect(csvSafe(null)).toBe("");
    expect(csvSafe(new Date("2020-02-03T10:00:00Z"))).toBe("2020-02-03");
  });

  it("quotes commas, quotes and newlines", () => {
    const csv = toCsv(["a", "b"], [{ a: 'Say "hi", ok', b: "line1\nline2" }]);
    expect(csv).toBe('a,b\r\n"Say ""hi"", ok","line1\nline2"');
  });
});
