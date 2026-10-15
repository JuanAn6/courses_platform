import { after } from "next/server";
import { UPLOAD_RULES, type UploadKind } from "@/features/entries/registry";
import { audit } from "@/lib/audit";
import { hasRole } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { CONVERTIBLE_MIMES, enqueuePdfConversion, sofficePath } from "@/lib/convert";
import { db } from "@/lib/db";
import { sanitizeFilename } from "@/lib/files";
import { storage, UploadTooLargeError } from "@/lib/storage";

/**
 * Streams a raw file body to storage (no size-limited Server Action involved).
 *   POST /api/uploads?kind=video|audio|document|presentation|image
 *   Content-Type: <file MIME type>, X-File-Name: <URI-encoded file name>
 * Responds with the new File. Uploaded files are visible only to their uploader until an entry
 * references them (see canReadFile).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to upload." }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind") as UploadKind | null;
  const rules = kind ? UPLOAD_RULES[kind] : undefined;
  if (!kind || !rules) return Response.json({ error: "Unknown upload kind." }, { status: 400 });
  // Students upload their own work; course content is authored by teachers and admins.
  const allowedRoles = kind === "submission" ? (["STUDENT", "ADMIN", "TEACHER"] as const) : (["ADMIN", "TEACHER"] as const);
  if (!hasRole(user.roles, ...allowedRoles)) return Response.json({ error: "You can't upload files." }, { status: 403 });

  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!Object.hasOwn(rules.mimes, mime)) {
    const allowed = [...new Set(Object.values(rules.mimes))].join(", ");
    return Response.json({ error: `This file type isn't allowed here. Allowed: ${allowed}.` }, { status: 415 });
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > rules.maxBytes) {
    return Response.json({ error: new UploadTooLargeError(rules.maxBytes).message }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "Empty upload." }, { status: 400 });

  let name: string;
  try {
    name = sanitizeFilename(decodeURIComponent(request.headers.get("x-file-name") ?? "file"));
  } catch {
    name = "file";
  }
  const convert = kind === "presentation" && CONVERTIBLE_MIMES.has(mime);
  if (convert && !sofficePath()) {
    return Response.json({ error: "PowerPoint conversion isn't available on this server. Upload a PDF instead." }, { status: 415 });
  }

  const key = `${kind === "submission" ? "submissions" : "entries"}/${user.id}/${crypto.randomUUID()}-${name}`;
  let size: number;
  try {
    ({ size } = await storage.putStream(key, request.body, rules.maxBytes));
  } catch (error) {
    if (error instanceof UploadTooLargeError) return Response.json({ error: error.message }, { status: 413 });
    console.error("[upload] failed", error);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
  if (size === 0) {
    await storage.delete(key);
    return Response.json({ error: "The file is empty." }, { status: 400 });
  }

  const file = await db.file.create({
    data: { storageKey: key, originalName: name, mime, size, ownerId: user.id, status: convert ? "PROCESSING" : "READY" },
  });
  await audit({ actorId: user.id, action: "file.upload", entityType: "File", entityId: file.id, diff: { kind, name, size } });
  if (convert) after(() => enqueuePdfConversion(file.id));

  return Response.json(
    { id: file.id, name: file.originalName, mime: file.mime, size: file.size, status: file.status },
    { status: 201 },
  );
}
