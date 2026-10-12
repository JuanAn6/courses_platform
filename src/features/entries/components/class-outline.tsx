import Link from "next/link";
import { CheckCircle2, Circle, CircleDot, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Outline, OutlineEntry, OutlineUnit } from "../outline";
import { ENTRY_TYPE_INFO, type EntryType } from "../registry";
import { EntryIcon } from "./entry-icon";

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function lockText(item: { lockReason: OutlineUnit["lockReason"]; availableAt: Date | null }, timezone: string, prerequisite?: string | null) {
  if (item.lockReason === "release" && item.availableAt) return `Opens ${formatDateTime(item.availableAt, timezone)}`;
  if (item.lockReason === "prerequisite") return prerequisite ? `Complete “${prerequisite}” first` : "Locked";
  return null;
}

function StatusIcon({ entry }: { entry: OutlineEntry }) {
  if (entry.locked) return <Lock className="size-4 text-muted-foreground" aria-label="Locked" />;
  if (entry.completed) return <CheckCircle2 className="size-4 text-emerald-600" aria-label="Completed" />;
  if (entry.percent > 0) return <CircleDot className="size-4 text-primary" aria-label="In progress" />;
  return <Circle className="size-4 text-muted-foreground" aria-label="Not started" />;
}

/** The student's view of a class's units and entries. */
export function ClassOutline({ outline, classId, timezone }: { outline: Outline; classId: string; timezone: string }) {
  return (
    <div className="grid gap-4">
      {outline.units.map((unit) => {
        const unitLock = lockText(unit, timezone, unit.prerequisiteTitle);
        return (
          <Card key={unit.id} className="gap-3">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold">{unit.title}</h2>
                {unit.requiredTotal ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {unit.requiredDone}/{unit.requiredTotal} done
                  </span>
                ) : null}
              </div>
              {unit.description ? <p className="whitespace-pre-line text-sm text-muted-foreground">{unit.description}</p> : null}
              {unitLock ? (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden /> {unitLock}
                </p>
              ) : null}
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1">
                {unit.entries.map((e) => {
                  const inner = (
                    <>
                      <StatusIcon entry={e} />
                      <EntryIcon type={e.type} />
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{ENTRY_TYPE_INFO[e.type as EntryType]?.label}</span>
                      {!e.required ? <Badge variant="outline">Optional</Badge> : null}
                      {e.overdue ? (
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive">Overdue</Badge>
                      ) : e.dueAt && !e.completed ? (
                        <span className="text-xs text-muted-foreground">Due {formatDateTime(e.dueAt, timezone)}</span>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {e.locked ? (
                        <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground" title={lockText(e, timezone, unit.prerequisiteTitle) ?? undefined}>
                          {inner}
                        </div>
                      ) : (
                        <Link
                          href={`/learn/classes/${classId}/entries/${e.id}`}
                          className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent", e.completed && "text-muted-foreground")}
                        >
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
