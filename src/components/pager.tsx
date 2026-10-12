import Link from "next/link";
import { Button } from "@/components/ui/button";

/** "First page / Next page" links for cursor pagination, preserving the current filters. */
export function Pager({
  basePath,
  params,
  cursor,
  nextCursor,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  cursor?: string;
  nextCursor: string | null;
}) {
  if (!cursor && !nextCursor) return null;
  const href = (c?: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (c) q.set("cursor", c);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="mt-4 flex gap-2" aria-label="Pagination">
      {cursor ? (
        <Button variant="outline" asChild>
          <Link href={href()}>First page</Link>
        </Button>
      ) : null}
      {nextCursor ? (
        <Button variant="outline" asChild>
          <Link href={href(nextCursor)}>Next page</Link>
        </Button>
      ) : null}
    </nav>
  );
}

/** Reads a single string from Next's searchParams value. */
export function searchParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}
