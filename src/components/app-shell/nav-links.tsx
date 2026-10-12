"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  CalendarRange,
  ClipboardList,
  Contact,
  FolderTree,
  GraduationCap,
  History,
  House,
  Library,
  School,
  Search,
  Settings,
  Shield,
  Upload,
  User,
  UserCog,
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
  "user-cog": UserCog,
  contact: Contact,
  upload: Upload,
  library: Library,
  school: School,
  folders: FolderTree,
  "calendar-range": CalendarRange,
  clipboard: ClipboardList,
  search: Search,
};

/** The single best-matching item: exact match, else the longest href that prefixes the path.
 * Area roots (/admin) only match exactly, so their sub-pages highlight the specific item. */
function activeHref(pathname: string, sections: NavSection[]): string | undefined {
  const roots = new Set(sections.map((s) => s.items[0]?.href).filter((h) => h && h !== "/dashboard"));
  let best: string | undefined;
  for (const item of sections.flatMap((s) => s.items)) {
    const matches = pathname === item.href || (!roots.has(item.href) && pathname.startsWith(`${item.href}/`));
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

export function NavLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = activeHref(pathname, sections);

  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <h2 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </h2>
          {section.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.href === current;
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
