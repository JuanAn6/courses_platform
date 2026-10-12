import { canReadFile, isPublicAsset } from "@/features/files/access";
import { getCurrentUser } from "@/lib/auth/session";
import { parseRange } from "@/lib/http-range";
import { storage } from "@/lib/storage";

const INLINE = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm)|audio\/.+|application\/pdf)$/;

/**
 * Authorized file download with HTTP range support (video/audio seeking).
 * Media, images and PDFs are served inline; `?download=1` forces a download.
 * Anonymous requests are allowed only for public files (catalog course covers).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  const { id } = await ctx.params;
  const { file, allowed } = await canReadFile(user, id);
  // Same response for "missing" and "forbidden" so file ids can't be probed.
  if (!file || !allowed) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    size = await storage.size(file.storageKey);
  } catch {
    return new Response("File is missing from storage", { status: 410 });
  }

  const url = new URL(request.url);
  const inline = INLINE.test(file.mime) && url.searchParams.get("download") !== "1";
  const asciiName = file.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": isPublicAsset(file) ? "public, max-age=300" : "private, no-store",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  };

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  if (range) {
    return new Response(storage.readStream(file.storageKey, range), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }
  return new Response(storage.readStream(file.storageKey), { headers: { ...headers, "Content-Length": String(size) } });
}
