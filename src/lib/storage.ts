import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";

/**
 * Blob storage. Local-disk driver for now; phase 4 adds an S3-compatible driver behind the same API.
 * Keys are relative POSIX paths such as "student-docs/<userId>/<id>-name.pdf".
 */
export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
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
  async get(key) {
    return readFile(resolveKey(key));
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
};
