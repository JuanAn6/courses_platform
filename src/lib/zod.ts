import { z } from "zod";

/** Form-friendly Zod helpers: HTML forms send "" for empty fields and omit unchecked boxes. */

/** Optional text: trims, maps "" to null. */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

/** Optional yyyy-mm-dd date: "" → null, otherwise a UTC Date. */
export const optionalDate = () =>
  z
    .union([z.literal(""), z.iso.date("Use the format YYYY-MM-DD")])
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

/** Checkbox: present ("on"/"true") → true, absent → false. */
export const checkbox = () =>
  z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true");

/** Multi-value field (checkbox group / multi-select): one value arrives as a string, several as an array. */
export const formArray = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(item));

export const emailField = () => z.email("Enter a valid email").trim().toLowerCase().max(191);

export const nameField = () => z.string().trim().min(2, "Enter a name").max(100);

/** Date → "yyyy-mm-dd" for <input type="date"> default values. */
export function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}
