import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/session";
import { navigationFor } from "@/lib/navigation";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

export function AppShell({
  user,
  institutionName,
  children,
}: {
  user: CurrentUser;
  institutionName: string;
  children: React.ReactNode;
}) {
  const sections = navigationFor(user.roles);

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar p-4 md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 font-semibold">
          <GraduationCap className="size-5" aria-hidden />
          <span className="truncate">{institutionName}</span>
        </Link>
        <NavLinks sections={sections} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <MobileNav sections={sections} title={institutionName} />
          <span className="font-semibold md:hidden">{institutionName}</span>
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
