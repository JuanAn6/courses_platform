import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED";

const STATUS_STYLES: Record<UserStatus | "ARCHIVED", { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  INVITED: { label: "Invited", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  SUSPENDED: { label: "Suspended", className: "bg-amber-500/15 text-amber-800 dark:text-amber-400" },
  ARCHIVED: { label: "Archived", className: "bg-muted text-muted-foreground" },
};

export function UserStatusBadge({
  status,
  archived,
  prefix,
}: {
  status: UserStatus;
  archived?: boolean;
  /** e.g. "Account" → "Account: Active", to disambiguate from other statuses. */
  prefix?: string;
}) {
  const style = STATUS_STYLES[archived ? "ARCHIVED" : status];
  return (
    <Badge variant="secondary" className={cn("border-transparent", style.className)}>
      {prefix ? `${prefix}: ${style.label}` : style.label}
    </Badge>
  );
}

export function RoleBadges({ roles }: { roles: readonly Role[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} variant="outline">
          {ROLE_LABELS[r]}
        </Badge>
      ))}
    </span>
  );
}
