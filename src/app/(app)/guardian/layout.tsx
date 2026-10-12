import { requireArea } from "@/lib/auth/session";

export default async function GuardianLayout({ children }: { children: React.ReactNode }) {
  await requireArea("guardian");
  return children;
}
