import { z } from "zod";

/**
 * Each settings group is stored as one row in `settings` (key = group name).
 * Every field has a default so a missing or partial row still parses.
 */
export const settingsSchemas = {
  general: z.object({
    institutionName: z.string().trim().min(2).max(120).default("My Institution"),
    contactEmail: z.union([z.email(), z.literal("")]).default(""),
    timezone: z
      .string()
      .refine(isValidTimeZone, "Unknown time zone")
      .default("UTC"),
  }),
  academic: z.object({
    /** Minimum final grade (0–100) to pass a class and earn a certificate. */
    passingScore: z.coerce.number().int().min(0).max(100).default(60),
  }),
  messaging: z.object({
    allowStudentToStudent: z.coerce.boolean().default(false),
  }),
} as const;

export type SettingsGroup = keyof typeof settingsSchemas;
export type Settings<G extends SettingsGroup> = z.output<(typeof settingsSchemas)[G]>;

export const SETTINGS_GROUPS = Object.keys(settingsSchemas) as SettingsGroup[];

/** Parses a stored value, falling back to defaults for anything missing or invalid. */
export function parseSettings<G extends SettingsGroup>(group: G, raw: unknown): Settings<G> {
  const schema = settingsSchemas[group];
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data as Settings<G>;
  // Keep valid fields, reset invalid ones to their defaults.
  const fallback = schema.parse({}) as Record<string, unknown>;
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...fallback };
  for (const [key, value] of Object.entries(input)) {
    const field = schema.shape[key as keyof typeof schema.shape] as z.ZodType | undefined;
    if (field?.safeParse(value).success) merged[key] = value;
  }
  return schema.parse(merged) as Settings<G>;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
