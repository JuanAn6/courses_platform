import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ClassStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { Pager, searchParam } from "@/components/pager";
import { ClassStatusBadge, Seats } from "@/features/academics/components/badges";
import { listClasses, listTerms } from "@/features/academics/queries";
import { CLASS_STATUS_LABELS, CLASS_STATUSES } from "@/features/academics/schemas";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage({ searchParams }: PageProps<"/admin/classes">) {
  await requirePermission("classes.manage");
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const termId = searchParam(sp.term);
  const statusParam = searchParam(sp.status);
  const status = CLASS_STATUSES.includes(statusParam as ClassStatus) ? (statusParam as ClassStatus) : undefined;
  const cursor = searchParam(sp.cursor);
  const [{ items, nextCursor }, terms] = await Promise.all([listClasses({ q, termId, status, cursor }), listTerms()]);

  return (
    <>
      <PageHeader
        title="Classes"
        description="Each class delivers a course to a group, with its own teachers, students and dates."
        actions={
          <Button asChild>
            <Link href="/admin/classes/new"><Plus /> New class</Link>
          </Button>
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem_12rem_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search</label>
        <Input id="q" name="q" placeholder="Search class, code or course" defaultValue={q} />
        <label className="sr-only" htmlFor="term">Term</label>
        <NativeSelect id="term" name="term" defaultValue={termId ?? ""}>
          <option value="">All terms</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </NativeSelect>
        <label className="sr-only" htmlFor="status">Status</label>
        <NativeSelect id="status" name="status" defaultValue={status ?? ""}>
          <option value="">All but archived</option>
          {CLASS_STATUSES.map((s) => (
            <option key={s} value={s}>{CLASS_STATUS_LABELS[s]}</option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Course</TableHead>
              <TableHead className="hidden md:table-cell">Teachers</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No classes match these filters.</TableCell>
              </TableRow>
            ) : (
              items.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <Link href={`/admin/classes/${k.id}`} className="font-medium hover:underline">{k.name}</Link>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{k.code}</span>
                      {k.term ? ` · ${k.term.name}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>{k.course.title}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {k.members.map((m) => m.user.name).join(", ") || <span className="text-muted-foreground">None</span>}
                  </TableCell>
                  <TableCell><Seats count={k._count.members} capacity={k.capacity} /></TableCell>
                  <TableCell><ClassStatusBadge status={k.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pager basePath="/admin/classes" params={{ q, term: termId, status }} cursor={cursor} nextCursor={nextCursor} />
    </>
  );
}
