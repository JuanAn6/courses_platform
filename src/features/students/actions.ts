"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { action, command, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { diffObjects } from "@/lib/diff";
import {
  assertEmailAvailable,
  createInvitedUser,
  ensureStudentCodeSequence,
  generateStudentCode,
  sendInvite,
  type InviteResult,
} from "@/features/accounts/service";
import { parseStudentCsv, type StudentImportRow } from "./csv";
import { createStudentSchema, linkGuardianSchema, updateStudentSchema } from "./schemas";

type Tx = Prisma.TransactionClient;

async function assertStudentCodeAvailable(tx: Tx, code: string, exceptUserId?: string) {
  const existing = await tx.studentProfile.findUnique({ where: { studentCode: code }, select: { userId: true } });
  if (existing && existing.userId !== exceptUserId) throw new UserError(`Student code ${code} is already in use.`);
}

type ProfileInput = {
  studentCode: string | null;
  birthDate: Date | null;
  documentId: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalNotes: string | null;
  enrollmentDate: Date | null;
  status: "ACTIVE" | "GRADUATED" | "WITHDRAWN";
  officeNotes?: string | null;
};

function profileData(input: ProfileInput) {
  return {
    birthDate: input.birthDate,
    documentId: input.documentId,
    address: input.address,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    medicalNotes: input.medicalNotes,
    status: input.status,
    ...(input.enrollmentDate ? { enrollmentDate: input.enrollmentDate } : {}),
    ...(input.officeNotes !== undefined ? { officeNotes: input.officeNotes } : {}),
  };
}

/** Creates the user (INVITED) + student profile. Shared by the form and the CSV import. */
async function createStudentRecord(
  tx: Tx,
  input: ProfileInput & { name: string; email: string; phone: string | null },
) {
  if (input.studentCode) await assertStudentCodeAvailable(tx, input.studentCode);
  await assertEmailAvailable(tx, input.email);
  const user = await tx.user.create({
    data: { id: crypto.randomUUID(), name: input.name, email: input.email, phone: input.phone, status: "INVITED" },
  });
  await tx.userRole.create({ data: { userId: user.id, role: "STUDENT" } });
  await tx.studentProfile.create({
    data: { userId: user.id, studentCode: input.studentCode ?? (await generateStudentCode(tx)), ...profileData(input) },
  });
  return user;
}

export type CreateStudentData = { userId: string; invite: InviteResult | null };

export const createStudent = action(
  { permission: "students.manage", schema: createStudentSchema },
  async (input, actor) => {
    await ensureStudentCodeSequence();
    const user = await db.$transaction(async (tx) => {
      const created = await createStudentRecord(tx, input);
      await audit({ actorId: actor.id, action: "student.create", entityType: "User", entityId: created.id }, tx);
      return created;
    });
    const invite = input.sendInvite ? await sendInvite(user) : null;
    revalidatePath("/office/students");
    return { status: "success", data: { userId: user.id, invite } } satisfies ActionState<CreateStudentData>;
  },
);

export const updateStudent = action(
  { permission: "students.manage", schema: updateStudentSchema },
  async (input, actor) => {
    const current = await db.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      include: { studentProfile: true },
    });
    if (!current?.studentProfile) throw new UserError("Student not found.");

    await db.$transaction(async (tx) => {
      if (input.email !== current.email) await assertEmailAvailable(tx, input.email, current.id);
      const code = input.studentCode ?? current.studentProfile!.studentCode;
      if (code !== current.studentProfile!.studentCode) await assertStudentCodeAvailable(tx, code, current.id);

      await tx.user.update({
        where: { id: current.id },
        data: { name: input.name, email: input.email, phone: input.phone },
      });
      const nextProfile = { studentCode: code, ...profileData(input) };
      await tx.studentProfile.update({ where: { userId: current.id }, data: nextProfile });

      const before = { name: current.name, email: current.email, phone: current.phone, ...pick(current.studentProfile!, nextProfile) };
      const after = { name: input.name, email: input.email, phone: input.phone, ...nextProfile };
      const diff = diffObjects(redactMedical(before), redactMedical(after));
      if (Object.keys(diff.before).length > 0) {
        await audit({ actorId: actor.id, action: "student.update", entityType: "User", entityId: current.id, diff }, tx);
      }
    });
    revalidatePath(`/office/students/${input.userId}`);
    return { status: "success", message: "Student record saved." };
  },
);

function pick<T extends object>(source: T, keysFrom: object): Partial<T> {
  return Object.fromEntries(Object.keys(keysFrom).map((k) => [k, source[k as keyof T]])) as Partial<T>;
}

/** Audit entries record that medical notes changed, never their content. */
function redactMedical(o: Record<string, unknown>) {
  return { ...o, medicalNotes: o.medicalNotes ? "[set]" : null };
}

export type LinkGuardianData = { invite: InviteResult | null };

export const linkGuardian = action(
  { permission: "students.manage", schema: linkGuardianSchema },
  async (input, actor) => {
    const student = await db.user.findFirst({
      where: { id: input.studentId, deletedAt: null, studentProfile: { isNot: null } },
      select: { id: true, email: true },
    });
    if (!student) throw new UserError("Student not found.");
    if (input.email === student.email) throw new UserError("A student can't be their own guardian.");

    const { guardian, created } = await db.$transaction(async (tx) => {
      let guardian: { id: string; name: string; email: string };
      let created = false;
      if (input.mode === "existing") {
        const existing = await tx.user.findUnique({ where: { email: input.email } });
        if (!existing || existing.deletedAt) throw new UserError("No active account uses that email. Add a new guardian instead.");
        await tx.userRole.createMany({ data: [{ userId: existing.id, role: "GUARDIAN" }], skipDuplicates: true });
        guardian = existing;
      } else {
        guardian = await createInvitedUser(tx, { name: input.name, email: input.email, phone: input.phone, roles: ["GUARDIAN"] });
        created = true;
      }
      const already = await tx.guardianLink.findUnique({
        where: { guardianId_studentId: { guardianId: guardian.id, studentId: student.id } },
      });
      if (already) throw new UserError("This guardian is already linked to the student.");
      await tx.guardianLink.create({
        data: { guardianId: guardian.id, studentId: student.id, relationship: input.relationship },
      });
      await audit(
        {
          actorId: actor.id,
          action: "guardian.link",
          entityType: "User",
          entityId: student.id,
          diff: { guardianId: guardian.id, relationship: input.relationship, created },
        },
        tx,
      );
      return { guardian, created };
    });

    const invite = created && input.mode === "new" && input.sendInvite ? await sendInvite(guardian) : null;
    revalidatePath(`/office/students/${student.id}`);
    return { status: "success", message: "Guardian linked.", data: { invite } } satisfies ActionState<LinkGuardianData>;
  },
);

export const unlinkGuardian = command(
  { permission: "students.manage", schema: z.object({ studentId: z.string().min(1), guardianId: z.string().min(1) }) },
  async ({ studentId, guardianId }, actor) => {
    const removed = await db.guardianLink.deleteMany({ where: { studentId, guardianId } });
    if (removed.count === 0) throw new UserError("That guardian isn't linked to this student.");
    await audit({ actorId: actor.id, action: "guardian.unlink", entityType: "User", entityId: studentId, diff: { guardianId } });
    revalidatePath(`/office/students/${studentId}`);
    return { status: "success", message: "Guardian unlinked." };
  },
);

// ───────────── CSV import ─────────────

export type ImportPreviewRow = {
  line: number;
  name: string;
  email: string;
  guardian: string | null;
  errors: string[];
};
export type ImportPreview = { rows: ImportPreviewRow[]; fileErrors: string[]; validCount: number };

const csvSchema = z.object({ csv: z.string().min(1, "Choose a CSV file").max(2_000_000, "The file is too large") });

/** Validates against the file itself and the database (existing emails and codes). */
async function analyzeImport(csv: string) {
  const { rows, fileErrors } = parseStudentCsv(csv);
  if (fileErrors.length) return { rows: [], fileErrors };

  const valid = rows.flatMap((r) => (r.data ? [r.data] : []));
  const emails = valid.flatMap((r) => [r.email, ...(r.guardianEmail ? [r.guardianEmail] : [])]);
  const codes = valid.flatMap((r) => (r.studentCode ? [r.studentCode] : []));
  const [existingUsers, existingCodes] = await Promise.all([
    db.user.findMany({ where: { email: { in: emails } }, select: { email: true, deletedAt: true } }),
    db.studentProfile.findMany({ where: { studentCode: { in: codes } }, select: { studentCode: true } }),
  ]);
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));
  const takenCodes = new Set(existingCodes.map((c) => c.studentCode));

  const analyzed = rows.map((r) => {
    const errors = [...r.errors];
    if (r.data) {
      if (userByEmail.has(r.data.email)) errors.push("email: an account with this email already exists");
      if (r.data.studentCode && takenCodes.has(r.data.studentCode)) errors.push("studentCode: already in use");
      const g = r.data.guardianEmail ? userByEmail.get(r.data.guardianEmail) : undefined;
      if (g?.deletedAt) errors.push("guardianEmail: belongs to an archived account");
      if (r.data.guardianEmail && !g && !r.data.guardianName) {
        errors.push("guardianName: required to create a new guardian");
      }
    }
    return { ...r, errors };
  });
  return { rows: analyzed, fileErrors };
}

export const previewStudentImport = command(
  { permission: "students.manage", schema: csvSchema },
  async ({ csv }) => {
    const { rows, fileErrors } = await analyzeImport(csv);
    const preview: ImportPreview = {
      fileErrors,
      validCount: rows.filter((r) => r.errors.length === 0).length,
      rows: rows.map((r) => ({
        line: r.line,
        name: r.data?.name ?? "",
        email: r.data?.email ?? "",
        guardian: r.data?.guardianEmail ?? null,
        errors: r.errors,
      })),
    };
    return { status: "success", data: preview } satisfies ActionState<ImportPreview>;
  },
);

export type ImportResult = {
  created: number;
  skipped: number;
  invites: { name: string; email: string; url: string; delivered: boolean }[];
};

export const commitStudentImport = command(
  { permission: "students.manage", schema: csvSchema.extend({ sendInvites: z.boolean() }) },
  async ({ csv, sendInvites }, actor) => {
    const { rows, fileErrors } = await analyzeImport(csv);
    if (fileErrors.length) throw new UserError(fileErrors.join(" "));
    const importable = rows.filter((r): r is typeof r & { data: StudentImportRow } => !!r.data && r.errors.length === 0);
    if (importable.length === 0) throw new UserError("There are no valid rows to import.");

    await ensureStudentCodeSequence();
    // One transaction: either the whole batch is imported or nothing is.
    const toInvite = await db.$transaction(
      async (tx) => {
        const invitees: { id: string; name: string; email: string }[] = [];
        for (const { data } of importable) {
          const student = await createStudentRecord(tx, data);
          invitees.push(student);
          if (data.guardianEmail) {
            let guardian = await tx.user.findUnique({ where: { email: data.guardianEmail } });
            if (guardian) {
              await tx.userRole.createMany({ data: [{ userId: guardian.id, role: "GUARDIAN" }], skipDuplicates: true });
            } else {
              guardian = await createInvitedUser(tx, {
                name: data.guardianName!,
                email: data.guardianEmail,
                phone: data.guardianPhone,
                roles: ["GUARDIAN"],
              });
              invitees.push(guardian);
            }
            await tx.guardianLink.create({
              data: { guardianId: guardian.id, studentId: student.id, relationship: data.guardianRelationship ?? "Guardian" },
            });
          }
        }
        await audit(
          { actorId: actor.id, action: "student.import", entityType: "User", diff: { created: importable.length } },
          tx,
        );
        return invitees;
      },
      { timeout: 120_000 },
    );

    const invites: ImportResult["invites"] = [];
    if (sendInvites) {
      for (const u of toInvite) {
        const { url, delivered } = await sendInvite(u);
        invites.push({ name: u.name, email: u.email, url, delivered });
      }
    }
    revalidatePath("/office/students");
    return {
      status: "success",
      message: `Imported ${importable.length} student${importable.length === 1 ? "" : "s"}.`,
      data: { created: importable.length, skipped: rows.length - importable.length, invites },
    } satisfies ActionState<ImportResult>;
  },
);
