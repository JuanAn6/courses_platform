/** Student codes look like S2026-001: "S", enrollment year, then a per-year sequence. */

export const STUDENT_CODE_PATTERN = /^S(\d{4})-(\d{3,})$/;

export function studentCodePrefix(year: number): string {
  return `S${year}-`;
}

export function formatStudentCode(year: number, n: number): string {
  return `${studentCodePrefix(year)}${String(n).padStart(3, "0")}`;
}

/** Highest sequence number among codes for that year (numeric, so S2026-1000 > S2026-999). */
export function highestSequence(codes: string[], year: number): number {
  let max = 0;
  for (const code of codes) {
    const m = code.match(STUDENT_CODE_PATTERN);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return max;
}
