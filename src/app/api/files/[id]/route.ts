import { canReadFile, isPublicAsset } from "@/features/files/access";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/lib/storage";

/**
 * Authorized file download. Images are shown inline; `?inline=1` also displays PDFs in the browser.
 * Anonymous requests are allowed only for public files (catalog course covers).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  const { id } = await ctx.params;
  const { file, allowed } = await canReadFile(user, id);
  // Same response for "missing" and "forbidden" so file ids can't be probed.
  if (!file || !allowed) return new Response("Not found", { status: 404 });

  let data: Uint8Array;
  try {
    data = await storage.get(file.storageKey);
  } catch {
    return new Response("File is missing from storage", { status: 410 });
  }

  const isImage = /^image\/(jpeg|png|webp)$/.test(file.mime);
  const inline = isImage || (new URL(request.url).searchParams.get("inline") === "1" && file.mime === "application/pdf");
  const asciiName = file.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublicAsset(file) ? "public, max-age=300" : "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
