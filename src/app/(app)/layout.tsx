import { AppShell } from "@/components/app-shell/app-shell";
import { getSettings } from "@/features/settings/queries";
import { requireUser } from "@/lib/auth/session";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [user, { institutionName }] = await Promise.all([requireUser(), getSettings("general")]);
  return (
    <AppShell user={user} institutionName={institutionName}>
      {children}
    </AppShell>
  );
}
