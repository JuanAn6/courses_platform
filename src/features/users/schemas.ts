import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";
import { checkbox, emailField, formArray, nameField, optionalText } from "@/lib/zod";

export const roleSchema = z.enum(ROLES);

export const userFormSchema = z.object({
  name: nameField(),
  email: emailField(),
  phone: optionalText(30),
  roles: formArray(roleSchema).pipe(z.array(roleSchema).min(1, "Choose at least one role")),
});

export const inviteUserSchema = userFormSchema.extend({ sendInvite: checkbox() });

export const updateUserSchema = userFormSchema.extend({ userId: z.string().min(1) });

export const USER_STATUS_FILTERS = ["active", "invited", "suspended", "archived", "all"] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];
