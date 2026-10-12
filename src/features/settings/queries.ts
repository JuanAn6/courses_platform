import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { parseSettings, type Settings, type SettingsGroup } from "./schemas";

/** Reads one settings group with defaults applied. Memoized per request. */
export const getSettings = cache(async <G extends SettingsGroup>(group: G): Promise<Settings<G>> => {
  const row = await db.setting.findUnique({ where: { key: group } });
  return parseSettings(group, row?.value);
});
