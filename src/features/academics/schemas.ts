import { z } from "zod";
import { checkbox, optionalDate, optionalText } from "@/lib/zod";

export const COURSE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const COURSE_STATUS_LABELS: Record<(typeof COURSE_STATUSES)[number], string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};
export const COURSE_VISIBILITIES = ["CATALOG", "PRIVATE"] as const;
export const COURSE_VISIBILITY_LABELS: Record<(typeof COURSE_VISIBILITIES)[number], string> = {
  CATALOG: "Listed in the catalog",
  PRIVATE: "Private (members only)",
};
export const CLASS_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export const CLASS_STATUS_LABELS: Record<(typeof CLASS_STATUSES)[number], string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};
export const BOARD_POLICIES = ["STUDENTS_CAN_POST", "COMMENT_ONLY", "READ_ONLY"] as const;
export const BOARD_POLICY_LABELS: Record<(typeof BOARD_POLICIES)[number], string> = {
  STUDENTS_CAN_POST: "Students can post and comment",
  COMMENT_ONLY: "Students can only comment",
  READ_ONLY: "Read-only for students",
};
export const STAFF_ROLES = ["TEACHER", "ASSISTANT"] as const;

const requiredDate = (label: string) =>
  z.iso.date(`Enter the ${label} (YYYY-MM-DD)`).transform((v) => new Date(`${v}T00:00:00Z`));

const codeField = () =>
  z
    .string()
    .trim()
    .min(2, "Enter a code")
    .max(40)
    .regex(/^[A-Za-z0-9][\w-]*$/, "Use letters, numbers, - and _ only")
    .transform((v) => v.toUpperCase());

const optionalId = () =>
  z
    .string()
    .optional()
    .transform((v) => v || null);

const optionalPositiveInt = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int("Use a whole number").min(1, "Must be at least 1").max(10_000).nullable());

function datesInOrder(d: { startDate: Date | null; endDate: Date | null }) {
  return !d.startDate || !d.endDate || d.endDate >= d.startDate;
}

export const categorySchema = z.object({
  id: optionalId(),
  name: z.string().trim().min(2, "Enter a name").max(80),
  description: optionalText(500),
  parentId: optionalId(),
});

export const termSchema = z
  .object({
    id: optionalId(),
    name: z.string().trim().min(2, "Enter a name").max(80),
    startDate: requiredDate("start date"),
    endDate: requiredDate("end date"),
  })
  .refine(datesInOrder, { message: "The end date must be after the start date", path: ["endDate"] });

export const courseSchema = z.object({
  code: codeField(),
  title: z.string().trim().min(2, "Enter a title").max(150),
  summary: optionalText(300),
  description: optionalText(10_000),
  level: optionalText(50),
  categoryId: optionalId(),
  status: z.enum(COURSE_STATUSES),
  visibility: z.enum(COURSE_VISIBILITIES),
  selfEnroll: checkbox(),
});
export const updateCourseSchema = courseSchema.extend({ courseId: z.string().min(1) });

export const classSchema = z
  .object({
    courseId: z.string().min(1, "Choose a course"),
    termId: optionalId(),
    name: z.string().trim().min(2, "Enter a name").max(120),
    code: codeField(),
    startDate: optionalDate(),
    endDate: optionalDate(),
    capacity: optionalPositiveInt(),
    status: z.enum(CLASS_STATUSES),
    boardPolicy: z.enum(BOARD_POLICIES),
  })
  .refine(datesInOrder, { message: "The end date must be after the start date", path: ["endDate"] });
export const updateClassSchema = classSchema.and(z.object({ classId: z.string().min(1) }));

export const cloneClassSchema = z
  .object({
    sourceClassId: z.string().min(1),
    termId: optionalId(),
    name: z.string().trim().min(2, "Enter a name").max(120),
    code: codeField(),
    startDate: optionalDate(),
    endDate: optionalDate(),
  })
  .refine(datesInOrder, { message: "The end date must be after the start date", path: ["endDate"] });

export const cloneCourseSchema = z.object({
  sourceCourseId: z.string().min(1),
  code: codeField(),
  title: z.string().trim().min(2, "Enter a title").max(150),
});
