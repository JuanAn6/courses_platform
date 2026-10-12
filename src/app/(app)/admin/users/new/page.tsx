import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { InviteUserForm } from "./invite-user-form";

export const metadata: Metadata = { title: "Invite user" };

export default async function NewUserPage() {
  await requirePermission("users.manage");
  return (
    <>
      <PageHeader
        title="Invite user"
        description="The person receives a link to set their password. To add students with full records, use Office → Students."
      />
      <InviteUserForm />
    </>
  );
}
