import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "@/env";

/**
 * Blob storage. Local-disk driver for now; an S3-compatible driver can implement the same API.
 * Keys are relative POSIX paths such as "entries/<userId>/<id>-name.pdf".
 */
export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>;
  /** Streams a body to storage; rejects (and removes the partial blob) when it exceeds maxBytes. */
  putStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<{ size: number }>;
  get(key: string): Promise<Uint8Array>;
  size(key: string): Promise<number>;
  /** Byte range (inclusive end) as a web stream, for HTTP range requests. */
  readStream(key: string, range?: { start: number; end: number }): ReadableStream<Uint8Array>;
  delete(key: string): Promise<void>;
  /** Absolute local path (local driver only; used by converters). */
  localPath(key: string): string;
}

export class UploadTooLargeError extends Error {
  constructor(public maxBytes: number) {
    super(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
    this.name = "UploadTooLargeError";
  }
}

const root = path.resolve(env.STORAGE_DIR);

function resolveKey(key: string): string {
  const full = path.resolve(root, key);
  // Reject traversal outside the storage root.
  if (!full.startsWith(root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
  return full;
}

export const storage: Storage = {
  async put(key, data) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },
  async putStream(key, body, maxBytes) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    let size = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        size += chunk.length;
        if (size > maxBytes) done(new UploadTooLargeError(maxBytes));
        else done(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), limiter, createWriteStream(full));
    } catch (error) {
      await rm(full, { force: true });
      throw error;
    }
    return { size };
  },
  async get(key) {
    return readFile(resolveKey(key));
  },
  async size(key) {
    return (await stat(resolveKey(key))).size;
  },
  readStream(key, range) {
    const stream = createReadStream(resolveKey(key), range ? { start: range.start, end: range.end } : undefined);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
  localPath(key) {
    return resolveKey(key);
  },
};
