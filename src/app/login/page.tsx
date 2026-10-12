import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettings } from "@/features/settings/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(Array.isArray(next) ? next[0] : next);

  if (await getCurrentUser()) redirect(nextPath);
  const { institutionName } = await getSettings("general");

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold">
          <GraduationCap className="size-5" aria-hidden />
          {institutionName}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the email and password your institution gave you.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={nextPath} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
