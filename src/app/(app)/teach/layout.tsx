import { requireArea } from "@/lib/auth/session";

export default async function TeachLayout({ children }: { children: React.ReactNode }) {
  await requireArea("teach");
  return children;
}
