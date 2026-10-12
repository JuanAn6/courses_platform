"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Eye, KeyRound, Mail, Pause, Play } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { LinkDelivery } from "@/components/copy-link";
import { resendInvite, sendPasswordReset } from "@/features/accounts/actions";
import type { InviteResult } from "@/features/accounts/service";
import { impersonateUser, setUserArchived, setUserSuspended } from "@/features/users/actions";

type Props = {
  user: {
    id: string;
    name: string;
    status: "ACTIVE" | "INVITED" | "SUSPENDED";
    archived: boolean;
    isAdmin: boolean;
    isSelf: boolean;
  };
};

export function UserActions({ user }: Props) {
  const [link, setLink] = useState<(InviteResult & { kind: "invite" | "reset" }) | null>(null);
  const userId = user.id;

  if (user.archived) {
    return (
      <ConfirmButton
        run={() => setUserArchived({ userId, archived: false })}
        label={<><ArchiveRestore /> Restore account</>}
        title={`Restore ${user.name}?`}
        description="The account returns with its previous status and roles."
        confirmLabel="Restore"
      />
    );
  }

  return (
    <div className="grid gap-3 [&_button]:justify-start">
      {user.status === "INVITED" ? (
        <ConfirmButton<InviteResult>
          run={() => resendInvite({ userId })}
          label={<><Mail /> Send new invite link</>}
          title="Send a new invite link?"
          description="Any earlier invite link stops working."
          confirmLabel="Send invite"
          onSuccess={(data) => data && setLink({ ...data, kind: "invite" })}
        />
      ) : null}
      {user.status === "ACTIVE" ? (
        <ConfirmButton<InviteResult>
          run={() => sendPasswordReset({ userId })}
          label={<><KeyRound /> Send password reset link</>}
          title="Send a password reset link?"
          description="The user can choose a new password with it. Their current password keeps working until then."
          confirmLabel="Send link"
          onSuccess={(data) => data && setLink({ ...data, kind: "reset" })}
        />
      ) : null}
      {link ? <LinkDelivery url={link.url} delivered={link.delivered} kind={link.kind} /> : null}

      {user.status === "ACTIVE" && !user.isAdmin && !user.isSelf ? (
        <ConfirmButton
          run={() => impersonateUser({ userId })}
          label={<><Eye /> View as {user.name.split(" ")[0]}</>}
          title={`View the platform as ${user.name}?`}
          description="You'll see exactly what they see for up to one hour. Everything you do is recorded in the audit log under your name."
          confirmLabel="Start"
        />
      ) : null}

      {!user.isSelf && user.status === "ACTIVE" ? (
        <ConfirmButton
          run={() => setUserSuspended({ userId, suspended: true })}
          label={<><Pause /> Suspend account</>}
          title={`Suspend ${user.name}?`}
          description="They are signed out everywhere and can't sign in until reactivated."
          confirmLabel="Suspend"
          destructive
        />
      ) : null}
      {user.status === "SUSPENDED" ? (
        <ConfirmButton
          run={() => setUserSuspended({ userId, suspended: false })}
          label={<><Play /> Reactivate account</>}
          title={`Reactivate ${user.name}?`}
          description="They can sign in again with their existing password."
          confirmLabel="Reactivate"
        />
      ) : null}
      {!user.isSelf ? (
        <ConfirmButton
          run={() => setUserArchived({ userId, archived: true })}
          label={<><Archive /> Archive account</>}
          title={`Archive ${user.name}?`}
          description="The account is hidden and can't sign in. Its records (grades, documents, history) are kept and it can be restored."
          confirmLabel="Archive"
          destructive
        />
      ) : null}
    </div>
  );
}
