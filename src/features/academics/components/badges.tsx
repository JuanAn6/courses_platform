import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CLASS_STATUS_LABELS, COURSE_STATUS_LABELS } from "../schemas";

const TONE = {
  neutral: "bg-muted text-muted-foreground",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  blue: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
};

export function CourseStatusBadge({ status }: { status: keyof typeof COURSE_STATUS_LABELS }) {
  const tone = status === "PUBLISHED" ? TONE.green : status === "DRAFT" ? TONE.amber : TONE.neutral;
  return (
    <Badge variant="secondary" className={cn("border-transparent", tone)}>
      {COURSE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ClassStatusBadge({ status }: { status: keyof typeof CLASS_STATUS_LABELS }) {
  const tone =
    status === "ACTIVE" ? TONE.green : status === "DRAFT" ? TONE.amber : status === "COMPLETED" ? TONE.blue : TONE.neutral;
  return (
    <Badge variant="secondary" className={cn("border-transparent", tone)}>
      {CLASS_STATUS_LABELS[status]}
    </Badge>
  );
}

/** "12 / 30" seats, or "12 students" when unlimited. */
export function Seats({ count, capacity }: { count: number; capacity: number | null }) {
  return (
    <span className="tabular-nums">
      {capacity ? `${count} / ${capacity}` : `${count} student${count === 1 ? "" : "s"}`}
    </span>
  );
}
