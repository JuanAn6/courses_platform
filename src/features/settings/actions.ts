"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { diffObjects } from "@/lib/diff";
import { parseSettings, settingsSchemas } from "./schemas";

const updateSchema = z.object({
  institutionName: settingsSchemas.general.shape.institutionName,
  contactEmail: settingsSchemas.general.shape.contactEmail,
  timezone: settingsSchemas.general.shape.timezone,
  passingScore: settingsSchemas.academic.shape.passingScore,
  // Unchecked checkboxes are absent from FormData.
  allowStudentToStudent: z
    .union([z.literal("on"), z.literal("true")])
    .optional()
    .transform((v) => v !== undefined),
});

export const updateSettings = action(
  { permission: "settings.manage", schema: updateSchema },
  async (input, user) => {
    const next = {
      general: {
        institutionName: input.institutionName,
        contactEmail: input.contactEmail,
        timezone: input.timezone,
      },
      academic: { passingScore: input.passingScore },
      messaging: { allowStudentToStudent: input.allowStudentToStudent },
    };

    await db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(next)) {
        const existing = await tx.setting.findUnique({ where: { key } });
        const before = parseSettings(key as keyof typeof next, existing?.value);
        await tx.setting.upsert({
          where: { key },
          create: { key, value, updatedById: user.id },
          update: { value, updatedById: user.id },
        });
        const diff = diffObjects(before, value);
        if (Object.keys(diff.before).length > 0) {
          await audit({ actorId: user.id, action: "settings.update", entityType: "Setting", entityId: key, diff }, tx);
        }
      }
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Settings saved." };
  },
);
