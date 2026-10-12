import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stopImpersonating } from "@/features/users/actions";

export function ImpersonationBanner({ userName, adminName }: { userName: string; adminName: string }) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm text-amber-950">
      <Eye className="size-4" aria-hidden />
      <span>
        You ({adminName}) are viewing the platform as <strong>{userName}</strong>.
      </span>
      <form action={stopImpersonating}>
        <Button type="submit" size="sm" variant="outline" className="h-7 border-amber-950/30 bg-amber-50 text-amber-950 hover:bg-amber-100">
          Stop viewing as {userName.split(" ")[0]}
        </Button>
      </form>
    </div>
  );
}
