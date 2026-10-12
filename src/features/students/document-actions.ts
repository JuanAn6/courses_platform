"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, command, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DOCUMENT_MIME_TYPES, isAllowedDocumentType, MAX_UPLOAD_BYTES, sanitizeFilename } from "@/lib/files";
import { storage } from "@/lib/storage";
import { optionalText } from "@/lib/zod";
import { DOCUMENT_TYPES } from "./schemas";

const uploadSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().max(150).optional(),
  notes: optionalText(1000),
  file: z
    .instanceof(File, { message: "Choose a file" })
    .refine((f) => f.size > 0, "Choose a file")
    .refine((f) => f.size <= MAX_UPLOAD_BYTES, "Files can be at most 10 MB")
    .refine((f) => isAllowedDocumentType(f.type), {
      message: `Allowed types: ${[...new Set(Object.values(DOCUMENT_MIME_TYPES))].join(", ")}`,
    }),
});

export const uploadStudentDocument = action(
  { permission: "students.manage", schema: uploadSchema },
  async (input, actor) => {
    const student = await db.user.findFirst({
      where: { id: input.studentId, deletedAt: null, studentProfile: { isNot: null } },
      select: { id: true },
    });
    if (!student) throw new UserError("Student not found.");

    const fileName = sanitizeFilename(input.file.name);
    const key = `student-docs/${student.id}/${crypto.randomUUID()}-${fileName}`;
    await storage.put(key, new Uint8Array(await input.file.arrayBuffer()));

    try {
      await db.$transaction(async (tx) => {
        const file = await tx.file.create({
          data: { storageKey: key, originalName: fileName, mime: input.file.type, size: input.file.size, ownerId: actor.id },
        });
        const doc = await tx.studentDocument.create({
          data: {
            studentId: student.id,
            fileId: file.id,
            type: input.type,
            title: input.title || fileName,
            notes: input.notes,
            uploadedById: actor.id,
          },
        });
        await audit(
          { actorId: actor.id, action: "student.document.upload", entityType: "StudentDocument", entityId: doc.id, diff: { studentId: student.id, fileName } },
          tx,
        );
      });
    } catch (error) {
      await storage.delete(key); // don't leave orphaned blobs
      throw error;
    }

    revalidatePath(`/office/students/${student.id}`);
    return { status: "success", message: "Document uploaded." };
  },
);

export const deleteStudentDocument = command(
  { permission: "students.manage", schema: z.object({ documentId: z.string().min(1) }) },
  async ({ documentId }, actor) => {
    const doc = await db.studentDocument.findUnique({ where: { id: documentId }, include: { file: true } });
    if (!doc) throw new UserError("Document not found.");
    await db.$transaction(async (tx) => {
      await tx.file.delete({ where: { id: doc.fileId } }); // cascades to the document row
      await audit(
        { actorId: actor.id, action: "student.document.delete", entityType: "StudentDocument", entityId: doc.id, diff: { studentId: doc.studentId, title: doc.title } },
        tx,
      );
    });
    await storage.delete(doc.file.storageKey);
    revalidatePath(`/office/students/${doc.studentId}`);
    return { status: "success", message: "Document deleted." };
  },
);
