import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { searchParam } from "@/components/pager";
import { CourseCover } from "@/features/academics/components/course-cover";
import { listCatalog, listCatalogCategories } from "@/features/academics/queries";

export const metadata: Metadata = { title: "Course catalog" };

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const category = searchParam(sp.category);
  const [courses, categories] = await Promise.all([listCatalog({ q, categorySlug: category }), listCatalogCategories()]);

  return (
    <>
      <PageHeader title="Course catalog" description="Browse the courses we offer." />
      <form className="mb-6 grid gap-2 sm:grid-cols-[1fr_14rem_auto]" role="search">
        <label htmlFor="q" className="sr-only">Search courses</label>
        <Input id="q" name="q" placeholder="Search courses" defaultValue={q} />
        <label htmlFor="category" className="sr-only">Category</label>
        <NativeSelect id="category" name="category" defaultValue={category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline"><Search /> Search</Button>
      </form>

      {courses.length === 0 ? (
        <EmptyState icon={Search} title="No courses found" description="Try another search or category." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/catalog/${c.slug}`} className="group rounded-xl focus-visible:outline-none">
              <Card className="h-full overflow-hidden pt-0 transition-colors group-hover:bg-accent/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CourseCover coverFileId={c.coverFileId} title={c.title} />
                <CardHeader>
                  <CardTitle>{c.title}</CardTitle>
                  {c.summary ? <CardDescription>{c.summary}</CardDescription> : null}
                  <div className="flex flex-wrap gap-1 pt-2">
                    {c.category ? <Badge variant="outline">{c.category.name}</Badge> : null}
                    {c.level ? <Badge variant="outline">{c.level}</Badge> : null}
                    {c.selfEnroll ? <Badge variant="secondary">Open enrollment</Badge> : null}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
