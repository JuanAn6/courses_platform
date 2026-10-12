/**
 * The requested order, followed by any items the client didn't know about (added by someone else
 * since the page loaded), so positions stay unique. Null if the request names unknown items.
 */
export function completeOrder(requested: string[], existing: string[]): string[] | null {
  const known = new Set(existing);
  if (requested.some((id) => !known.has(id)) || new Set(requested).size !== requested.length) return null;
  const listed = new Set(requested);
  return [...requested, ...existing.filter((id) => !listed.has(id))];
}
