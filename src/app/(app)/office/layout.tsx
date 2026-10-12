import { requireArea } from "@/lib/auth/session";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  await requireArea("office");
  return children;
}
