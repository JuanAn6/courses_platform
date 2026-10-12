import { describe, expect, it } from "vitest";
import { formatBytes, isAllowedDocumentType, sanitizeFilename } from "./files";

describe("sanitizeFilename", () => {
  it("keeps readable names", () => {
    expect(sanitizeFilename("Report card 2026.pdf")).toBe("Report-card-2026.pdf");
    expect(sanitizeFilename("Matrícula Ñandú.pdf")).toBe("Matricula-Nandu.pdf");
  });

  it("strips paths and dangerous characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\x\\evil<script>.pdf")).toBe("evilscript.pdf");
    expect(sanitizeFilename(".hidden")).toBe("hidden");
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("a".repeat(300)).length).toBe(120);
  });
});

describe("document types", () => {
  it("allows office formats only", () => {
    expect(isAllowedDocumentType("application/pdf")).toBe(true);
    expect(isAllowedDocumentType("image/png")).toBe(true);
    expect(isAllowedDocumentType("text/html")).toBe(false);
    expect(isAllowedDocumentType("image/svg+xml")).toBe(false);
    expect(isAllowedDocumentType("application/x-msdownload")).toBe(false);
    expect(isAllowedDocumentType("toString")).toBe(false);
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
