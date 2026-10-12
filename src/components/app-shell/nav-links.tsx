"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  GraduationCap,
  History,
  House,
  Settings,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavSection } from "@/lib/navigation";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  user: User,
  shield: Shield,
  settings: Settings,
  history: History,
  briefcase: Briefcase,
  graduation: GraduationCap,
  book: BookOpen,
  users: Users,
};

/** Area roots (/admin) match exactly; other items also match their sub-pages. */
function isActive(pathname: string, href: string, sectionRoots: Set<string>) {
  if (sectionRoots.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const roots = new Set(sections.map((s) => s.items[0]?.href).filter((h) => h && h !== "/dashboard"));

  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <h2 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </h2>
          {section.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href, roots);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
