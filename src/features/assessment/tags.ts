/** Question tags (pure). Stored as ",tag-a,tag-b," so one tag can be matched with a LIKE query. */

export function normalizeTags(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[,;\n]/);
  const tags = raw
    .map((t) =>
      t
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40),
    )
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 10);
}

export function serializeTags(tags: string[]): string {
  return tags.length ? `,${tags.join(",")},` : "";
}

export function parseTags(stored: string): string[] {
  return stored.split(",").filter(Boolean);
}
