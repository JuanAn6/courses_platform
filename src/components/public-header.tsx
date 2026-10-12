import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicHeader({ institutionName, signedIn }: { institutionName: string; signedIn: boolean }) {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b px-4 md:px-8">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <GraduationCap className="size-5" aria-hidden />
        {institutionName}
      </Link>
      <nav className="flex items-center gap-2" aria-label="Site">
        <Button variant="ghost" asChild>
          <Link href="/catalog">Catalog</Link>
        </Button>
        <Button asChild>
          <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Go to dashboard" : "Sign in"}</Link>
        </Button>
      </nav>
    </header>
  );
}
