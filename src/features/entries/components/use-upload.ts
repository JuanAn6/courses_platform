"use client";

import { useCallback, useState } from "react";
import type { UploadKind } from "../registry";

export type UploadedFile = { id: string; name: string; mime: string; size: number; status: "READY" | "PROCESSING" | "FAILED" };

/** Uploads a file to /api/uploads with progress (XHR, since fetch has no upload progress). */
export function useUpload(kind: UploadKind) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    (file: File) =>
      new Promise<UploadedFile | null>((resolve) => {
        setError(null);
        setProgress(0);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/uploads?kind=${kind}`);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          setProgress(null);
          let body: { error?: string } & Partial<UploadedFile> = {};
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            /* non-JSON error page */
          }
          if (xhr.status === 201 && body.id) resolve(body as UploadedFile);
          else {
            setError(body.error ?? `Upload failed (${xhr.status}).`);
            resolve(null);
          }
        };
        xhr.onerror = () => {
          setProgress(null);
          setError("Upload failed. Check your connection and try again.");
          resolve(null);
        };
        xhr.send(file);
      }),
    [kind],
  );

  return { upload, progress, error, uploading: progress !== null };
}
