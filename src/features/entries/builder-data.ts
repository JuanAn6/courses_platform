import "server-only";
import { formatDateTime } from "@/lib/format";
import { utcToZonedInput } from "@/lib/timezone";
import type { BuilderUnit } from "./components/content-builder";
import type { getBuilderData } from "./queries";

type Units = Awaited<ReturnType<typeof getBuilderData>>["units"];

/** Shapes builder query results for the client, with dates in the institution's time zone. */
export function toBuilderUnits(units: Units, timezone: string): BuilderUnit[] {
  return units.map((u) => ({
    id: u.id,
    title: u.title,
    description: u.description,
    releaseAt: utcToZonedInput(u.releaseAt, timezone),
    releaseLabel: u.releaseAt ? formatDateTime(u.releaseAt, timezone) : null,
    prerequisiteUnitId: u.prerequisiteUnitId,
    entries: u.entries.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      status: e.status,
      required: e.required,
      releaseLabel: e.releaseAt ? formatDateTime(e.releaseAt, timezone) : null,
      dueLabel: e.dueAt ? formatDateTime(e.dueAt, timezone) : null,
    })),
  }));
}
