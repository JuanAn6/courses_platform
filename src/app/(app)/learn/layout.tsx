import { requireArea } from "@/lib/auth/session";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  await requireArea("learn");
  return children;
}
