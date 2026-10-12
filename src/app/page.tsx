import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/features/settings/queries";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const [{ institutionName }, user] = await Promise.all([getSettings("general"), getCurrentUser()]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-8">
        <span className="flex items-center gap-2 font-semibold">
          <GraduationCap className="size-5" aria-hidden />
          {institutionName}
        </span>
        <Button asChild>
          <Link href={user ? "/dashboard" : "/login"}>{user ? "Go to dashboard" : "Sign in"}</Link>
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Learn, teach and manage in one place.</h1>
        <p className="text-lg text-muted-foreground">
          {institutionName} brings courses, classes, teachers and students together, from content and quizzes
          to grades, attendance and news.
        </p>
        <div>
          <Button size="lg" asChild>
            <Link href={user ? "/dashboard" : "/login"}>{user ? "Continue" : "Sign in to get started"}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
