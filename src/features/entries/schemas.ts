import { z } from "zod";
import { checkbox, optionalText } from "@/lib/zod";
import { ENTRY_TYPES } from "./registry";

/** "YYYY-MM-DDTHH:mm" from a datetime-local input, or null. Converted to UTC in the action. */
export const localDateTime = () =>
  z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid date and time")])
    .optional()
    .transform((v) => v || null);

const optionalId = () =>
  z
    .string()
    .optional()
    .transform((v) => v || null);

export const createUnitSchema = z.object({
  courseId: z.string().min(1),
  classId: z.string().min(1).nullish(),
  title: z.string().trim().min(1, "Enter a title").max(150),
});

export const updateUnitSchema = z.object({
  unitId: z.string().min(1),
  title: z.string().trim().min(1, "Enter a title").max(150),
  description: optionalText(2000),
  releaseAt: localDateTime(),
  prerequisiteUnitId: optionalId(),
});

export const createEntrySchema = z.object({ unitId: z.string().min(1), type: z.enum(ENTRY_TYPES) });

export const updateEntrySchema = z
  .object({
    entryId: z.string().min(1),
    title: z.string().trim().min(1, "Enter a title").max(200),
    description: optionalText(2000),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    required: checkbox(),
    releaseAt: localDateTime(),
    dueAt: localDateTime(),
    /** JSON produced by the type-specific editor. */
    content: z.string().max(2_000_000),
  })
  .refine((d) => !d.releaseAt || !d.dueAt || d.dueAt >= d.releaseAt, {
    message: "The due date must be after the release date",
    path: ["dueAt"],
  });

export const reorderSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

export const overrideSchema = z.object({
  classId: z.string().min(1),
  targetId: z.string().min(1),
  kind: z.enum(["unit", "entry"]),
  hidden: z.boolean(),
  releaseAt: localDateTime(),
  dueAt: localDateTime(),
});

export const progressSchema = z.object({
  classId: z.string().min(1),
  entryId: z.string().min(1),
  /** 0–100 for media/pages tracking. */
  percent: z.number().min(0).max(100).optional(),
  /** Seconds (media) or page number (pages). */
  position: z.number().min(0).max(1e7).optional(),
  /** Seconds since the last report (capped server-side). */
  deltaSec: z.number().min(0).max(3600).optional(),
  /** Manual completion (manual/link tracking) or undo. */
  complete: z.boolean().optional(),
});
