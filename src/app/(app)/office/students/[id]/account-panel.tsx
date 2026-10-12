"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { LinkDelivery } from "@/components/copy-link";
import { UserStatusBadge } from "@/components/status-badges";
import { resendInvite, sendPasswordReset } from "@/features/accounts/actions";
import type { InviteResult } from "@/features/accounts/service";

export function AccountPanel({
  user,
  lastLogin,
  adminLink,
}: {
  user: { id: string; status: "ACTIVE" | "INVITED" | "SUSPENDED" };
  lastLogin: string | null;
  adminLink: string | null;
}) {
  const [link, setLink] = useState<(InviteResult & { kind: "invite" | "reset" }) | null>(null);

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd><UserStatusBadge status={user.status} /></dd>
        <dt className="text-muted-foreground">Last sign-in</dt>
        <dd>{lastLogin ?? "Never"}</dd>
      </dl>
      {user.status === "INVITED" ? (
        <p className="text-sm text-muted-foreground">The student hasn&apos;t activated their account yet.</p>
      ) : null}
      {user.status === "SUSPENDED" ? (
        <p className="text-sm text-muted-foreground">This account is suspended. An administrator can reactivate it.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {user.status === "INVITED" ? (
          <ConfirmButton<InviteResult>
            run={() => resendInvite({ userId: user.id })}
            label={<><Mail /> Send invite link</>}
            title="Send an invite link?"
            description="Any earlier invite link stops working."
            confirmLabel="Send invite"
            onSuccess={(data) => data && setLink({ ...data, kind: "invite" })}
          />
        ) : null}
        {user.status === "ACTIVE" ? (
          <ConfirmButton<InviteResult>
            run={() => sendPasswordReset({ userId: user.id })}
            label={<><KeyRound /> Send password reset link</>}
            title="Send a password reset link?"
            description="Their current password keeps working until they choose a new one."
            confirmLabel="Send link"
            onSuccess={(data) => data && setLink({ ...data, kind: "reset" })}
          />
        ) : null}
        {adminLink ? (
          <Button variant="ghost" asChild>
            <Link href={adminLink}>Manage in Administration</Link>
          </Button>
        ) : null}
      </div>
      {link ? <LinkDelivery url={link.url} delivered={link.delivered} kind={link.kind} /> : null}
    </div>
  );
}
