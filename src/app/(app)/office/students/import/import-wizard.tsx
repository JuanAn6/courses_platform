"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileUp } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  commitStudentImport,
  previewStudentImport,
  type ImportPreview,
  type ImportResult,
} from "@/features/students/actions";

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard({ template, columns }: { template: string; columns: string[] }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [sendInvites, setSendInvites] = useState(true);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    setPreview(null);
    if (!file) return setCsv(null);
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    startTransition(async () => {
      const res = await previewStudentImport({ csv: text });
      if (res.status === "success" && res.data) setPreview(res.data);
      else if (res.status === "error") toast.error(res.message);
    });
  }

  function commit() {
    if (!csv) return;
    startTransition(async () => {
      const res = await commitStudentImport({ csv, sendInvites });
      if (res.status === "success" && res.data) {
        setResult(res.data);
        toast.success(res.message ?? "Imported.");
      } else if (res.status === "error") toast.error(res.message);
    });
  }

  if (result) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
            Imported {result.created} student{result.created === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>
            {result.skipped ? `${result.skipped} row(s) with errors were skipped. ` : ""}
            {result.invites.length
              ? result.invites.every((i) => i.delivered)
                ? `${result.invites.length} invite(s) were emailed.`
                : "Email isn't configured, so invites weren't emailed. Download the invite links to share them."
              : "No invites were sent; you can send them from each record."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {result.invites.length ? (
            <Button
              variant="outline"
              onClick={() =>
                downloadText(
                  "invite-links.csv",
                  Papa.unparse(result.invites.map(({ name, email, url }) => ({ name, email, inviteLink: url }))),
                )
              }
            >
              <Download /> Download invite links
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/office/students">Go to students</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const errorRows = preview?.rows.filter((r) => r.errors.length) ?? [];

  return (
    <div className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Prepare your file</CardTitle>
          <CardDescription>
            Required columns: <code>name</code>, <code>email</code>. Optional: {columns.slice(2).map((c) => <code key={c} className="mr-1">{c}</code>)}.
            Dates use YYYY-MM-DD. Guardians are created or linked by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => downloadText("students-template.csv", template)}>
            <Download /> Download template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Upload and review</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label htmlFor="csv-file" className="sr-only">CSV file</label>
          <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
          {pending && !preview ? <p className="text-sm text-muted-foreground">Checking {fileName}…</p> : null}

          {preview?.fileErrors.length ? (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {preview.fileErrors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {preview && !preview.fileErrors.length ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm" data-testid="import-summary">
                <Badge variant="secondary">{preview.rows.length} rows</Badge>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">{preview.validCount} ready</Badge>
                {errorRows.length ? (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">{errorRows.length} with errors</Badge>
                ) : null}
              </div>
              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Line</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Guardian</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((r) => (
                      <TableRow key={r.line} className={r.errors.length ? "bg-destructive/5" : undefined}>
                        <TableCell className="tabular-nums">{r.line}</TableCell>
                        <TableCell>
                          <div>{r.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.guardian ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {r.errors.length ? (
                            <ul className="text-destructive">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                          ) : (
                            <span className="text-emerald-700">Ready</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {preview && preview.validCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Import</CardTitle>
            <CardDescription>
              {errorRows.length
                ? `Rows with errors are skipped. Fix them and import the file again later; rows already imported will then show as existing.`
                : "All rows are ready."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} className="size-4 accent-primary" />
              Send invite links to new students and guardians
            </label>
            <div>
              <Button onClick={commit} disabled={pending}>
                <FileUp /> {pending ? "Importing…" : `Import ${preview.validCount} student${preview.validCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
