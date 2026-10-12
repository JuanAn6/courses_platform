"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UPLOAD_RULES, type UploadKind } from "../registry";
import { useUpload, type UploadedFile } from "./use-upload";

/** "Upload" button with progress and errors. Calls onUploaded for each successful file. */
export function FilePicker({
  kind,
  label = "Upload file",
  multiple = false,
  onUploaded,
}: {
  kind: UploadKind;
  label?: string;
  multiple?: boolean;
  onUploaded: (file: UploadedFile) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, progress, error, uploading } = useUpload(kind);
  const rules = UPLOAD_RULES[kind];
  const types = [...new Set(Object.values(rules.mimes))].join(", ");

  return (
    <div className="grid gap-2">
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label={label}
        multiple={multiple}
        accept={Object.keys(rules.mimes).join(",")}
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          for (const f of files) {
            const uploaded = await upload(f);
            if (uploaded) onUploaded(uploaded);
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={uploading} onClick={() => input.current?.click()}>
          <Upload /> {uploading ? `Uploading… ${progress}%` : label}
        </Button>
        <span className="text-xs text-muted-foreground">
          {types} · up to {Math.round(rules.maxBytes / 1024 / 1024)} MB
        </span>
      </div>
      {uploading ? (
        <div className="h-1.5 w-full max-w-sm overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
