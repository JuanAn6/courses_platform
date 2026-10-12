import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyAccountToken } from "@/features/accounts/tokens";
import { getSettings } from "@/features/settings/queries";
import { db } from "@/lib/db";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };

export default async function SetPasswordPage({ params }: PageProps<"/set-password/[token]">) {
  const { token } = await params;
  const [verified, { institutionName }] = await Promise.all([
    verifyAccountToken(decodeURIComponent(token)),
    getSettings("general"),
  ]);
  const user = verified
    ? await db.user.findUnique({ where: { id: verified.userId }, select: { name: true, email: true, status: true, deletedAt: true } })
    : null;
  const usable = verified && user && !user.deletedAt && user.status !== "SUSPENDED";

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold">
          <GraduationCap className="size-5" aria-hidden />
          {institutionName}
        </Link>
        <Card>
          {usable ? (
            <>
              <CardHeader>
                <CardTitle>{verified.purpose === "invite" ? `Welcome, ${user.name.split(" ")[0]}` : "Choose a new password"}</CardTitle>
                <CardDescription>
                  {verified.purpose === "invite"
                    ? `Set a password to activate your account (${user.email}).`
                    : `Set a new password for ${user.email}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SetPasswordForm token={decodeURIComponent(token)} email={user.email} />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Link expired</CardTitle>
                <CardDescription>
                  This link is invalid, was already used, or has expired. Ask your institution for a new one.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">Go to sign in</Link>
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
