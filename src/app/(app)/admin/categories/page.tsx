import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { listCategoriesFlat } from "@/features/academics/queries";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requirePermission("courses.manage");
  const [nodes, details] = await Promise.all([
    listCategoriesFlat(),
    db.category.findMany({ select: { id: true, description: true } }),
  ]);
  const descriptions = new Map(details.map((d) => [d.id, d.description]));
  return (
    <>
      <PageHeader title="Categories" description="Group courses by subject. Categories can be nested." />
      <CategoryManager categories={nodes.map((n) => ({ ...n, description: descriptions.get(n.id) ?? null }))} />
    </>
  );
}
