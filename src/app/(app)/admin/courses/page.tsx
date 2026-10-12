import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { CourseStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { Pager, searchParam } from "@/components/pager";
import { CourseStatusBadge } from "@/features/academics/components/badges";
import { listCategoriesFlat, listCourses } from "@/features/academics/queries";
import { COURSE_STATUS_LABELS, COURSE_STATUSES } from "@/features/academics/schemas";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage({ searchParams }: PageProps<"/admin/courses">) {
  await requirePermission("courses.manage");
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const statusParam = searchParam(sp.status);
  const status = COURSE_STATUSES.includes(statusParam as CourseStatus) ? (statusParam as CourseStatus) : undefined;
  const categoryId = searchParam(sp.category);
  const cursor = searchParam(sp.cursor);
  const [{ items, nextCursor }, categories] = await Promise.all([
    listCourses({ q, status, categoryId, cursor }),
    listCategoriesFlat(),
  ]);

  return (
    <>
      <PageHeader
        title="Courses"
        description="Courses are templates; each delivery to a group is a class."
        actions={
          <Button asChild>
            <Link href="/admin/courses/new"><Plus /> New course</Link>
          </Button>
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem_12rem_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search</label>
        <Input id="q" name="q" placeholder="Search title or code" defaultValue={q} />
        <label className="sr-only" htmlFor="category">Category</label>
        <NativeSelect id="category" name="category" defaultValue={categoryId ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>
          ))}
        </NativeSelect>
        <label className="sr-only" htmlFor="status">Status</label>
        <NativeSelect id="status" name="status" defaultValue={status ?? ""}>
          <option value="">Draft & published</option>
          {COURSE_STATUSES.map((s) => (
            <option key={s} value={s}>{COURSE_STATUS_LABELS[s]}</option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Classes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No courses match these filters.</TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/admin/courses/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                    <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                  </TableCell>
                  <TableCell>{c.category?.name ?? "—"}</TableCell>
                  <TableCell><CourseStatusBadge status={c.status} /></TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{c._count.classes}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pager basePath="/admin/courses" params={{ q, status, category: categoryId }} cursor={cursor} nextCursor={nextCursor} />
    </>
  );
}
