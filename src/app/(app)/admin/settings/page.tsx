import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/features/settings/queries";
import { requirePermission } from "@/lib/auth/session";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const [general, academic, messaging] = await Promise.all([
    getSettings("general"),
    getSettings("academic"),
    getSettings("messaging"),
  ]);

  return (
    <>
      <PageHeader title="Settings" description="Institution-wide configuration. Changes are recorded in the audit log." />
      <SettingsForm defaults={{ ...general, ...academic, ...messaging }} timeZones={Intl.supportedValuesOf("timeZone")} />
    </>
  );
}
