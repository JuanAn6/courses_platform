"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Read-only link with a copy button (invite / reset links). */
export function CopyLink({ url, label = "Link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={url} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** Explains how a link was delivered, then shows it for manual sharing. */
export function LinkDelivery({
  url,
  delivered,
  kind,
}: {
  url: string;
  delivered: boolean;
  kind: "invite" | "reset";
}) {
  const what = kind === "invite" ? "invite" : "password reset link";
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="link-delivery">
      <p>
        {delivered
          ? `The ${what} was emailed. You can also share this link directly:`
          : `Email isn't configured, so the ${what} wasn't emailed. Share this link with the user:`}
      </p>
      <CopyLink url={url} label={kind === "invite" ? "Invite link" : "Reset link"} />
      <p className="text-xs text-muted-foreground">
        {kind === "invite" ? "Valid for 7 days." : "Valid for 2 hours."} It works once and replaces any earlier link.
      </p>
    </div>
  );
}
