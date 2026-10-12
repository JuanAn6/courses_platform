import { cn } from "@/lib/utils";

/** Course cover image, or a generated gradient with the title's initials when there is none. */
export function CourseCover({
  coverFileId,
  title,
  className,
}: {
  coverFileId: string | null;
  title: string;
  className?: string;
}) {
  if (coverFileId) {
    return (
      // Served by /api/files (auth-checked), so next/image optimization doesn't apply.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/files/${coverFileId}`} alt="" className={cn("aspect-[16/9] w-full object-cover", className)} />
    );
  }
  const hue = [...title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  const initials = title
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      aria-hidden
      className={cn("flex aspect-[16/9] w-full items-center justify-center text-3xl font-semibold text-white", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 45%), hsl(${(hue + 40) % 360} 60% 35%))` }}
    >
      {initials}
    </div>
  );
}
