import { AppShell } from "@/components/app-shell/app-shell";
import { PublicHeader } from "@/components/public-header";
import { getSettings } from "@/features/settings/queries";
import { getCurrentUser } from "@/lib/auth/session";

/** The catalog is public: signed-in users see it inside the app shell, visitors get a public header. */
export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const [user, { institutionName }] = await Promise.all([getCurrentUser(), getSettings("general")]);
  if (user) {
    return (
      <AppShell user={user} institutionName={institutionName}>
        {children}
      </AppShell>
    );
  }
  return (
    <div className="flex min-h-svh flex-col">
      <PublicHeader institutionName={institutionName} signedIn={false} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
