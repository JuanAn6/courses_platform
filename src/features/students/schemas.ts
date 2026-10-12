import { z } from "zod";
import { checkbox, emailField, nameField, optionalDate, optionalText } from "@/lib/zod";

export const STUDENT_STATUSES = ["ACTIVE", "GRADUATED", "WITHDRAWN"] as const;
export const STUDENT_STATUS_LABELS: Record<(typeof STUDENT_STATUSES)[number], string> = {
  ACTIVE: "Active",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
};

export const studentCodeField = () =>
  z
    .string()
    .trim()
    .max(30, "Use at most 30 characters")
    .regex(/^[\w-]*$/, "Use letters, numbers, - and _ only")
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null));

/** Fields shared by the student form and the CSV import. */
export const studentFields = {
  name: nameField(),
  email: emailField(),
  phone: optionalText(30),
  studentCode: studentCodeField(),
  birthDate: optionalDate(),
  documentId: optionalText(50),
  address: optionalText(500),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalText(30),
  medicalNotes: optionalText(2000),
  enrollmentDate: optionalDate(),
  status: z
    .union([z.enum(STUDENT_STATUSES), z.literal("")])
    .optional()
    .transform((v) => v || "ACTIVE"),
};

export const createStudentSchema = z.object({ ...studentFields, officeNotes: optionalText(2000), sendInvite: checkbox() });

export const updateStudentSchema = z.object({ ...studentFields, officeNotes: optionalText(2000), userId: z.string().min(1) });

export const RELATIONSHIPS = ["Mother", "Father", "Parent", "Grandparent", "Legal guardian", "Sibling", "Other"] as const;

export const linkGuardianSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("existing"),
    studentId: z.string().min(1),
    email: emailField(),
    relationship: z.string().trim().min(2, "Choose a relationship").max(50),
  }),
  z.object({
    mode: z.literal("new"),
    studentId: z.string().min(1),
    name: nameField(),
    email: emailField(),
    phone: optionalText(30),
    relationship: z.string().trim().min(2, "Choose a relationship").max(50),
    sendInvite: checkbox(),
  }),
]);

export const DOCUMENT_TYPES = ["ID_DOCUMENT", "TRANSCRIPT", "CONTRACT", "MEDICAL", "PHOTO", "OTHER"] as const;
export const DOCUMENT_TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  ID_DOCUMENT: "ID document",
  TRANSCRIPT: "Transcript",
  CONTRACT: "Contract",
  MEDICAL: "Medical",
  PHOTO: "Photo",
  OTHER: "Other",
};
