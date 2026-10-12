import { canReadFile } from "@/features/files/access";
import { getCurrentUser } from "@/lib/auth/session";

/** Conversion status of a file (polled by the presentation editor while PowerPoint → PDF runs). */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[id]/status">) {
  const user = await getCurrentUser();
  const { file, allowed } = await canReadFile(user, (await ctx.params).id);
  if (!file || !allowed) return Response.json({ error: "Not found" }, { status: 404 });
  const derived = (file.derived ?? {}) as { pdfFileId?: string; error?: string };
  return Response.json(
    { status: file.status, pdfFileId: derived.pdfFileId ?? null, error: derived.error ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
