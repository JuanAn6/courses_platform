/**
 * Converting between UTC instants and wall-clock values in the institution's time zone,
 * for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm"). Pure: uses Intl only.
 */

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Offset (ms) of the zone from UTC at a given instant. */
function offsetAt(instant: number, timeZone: string): number {
  const p = partsIn(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-03-10T14:30" in `timeZone` → UTC Date. Returns null for invalid input. */
export function zonedInputToUtc(value: string, timeZone: string): Date | null {
  const m = value.match(LOCAL_INPUT);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // First guess, then correct once for DST transitions between the guess and the result.
  let instant = wallAsUtc - offsetAt(wallAsUtc, timeZone);
  const corrected = wallAsUtc - offsetAt(instant, timeZone);
  if (corrected !== instant) instant = corrected;
  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** UTC Date → "YYYY-MM-DDTHH:mm" wall clock in `timeZone` (for datetime-local inputs). */
export function utcToZonedInput(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "";
  const p = partsIn(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
