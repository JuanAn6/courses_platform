"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { NativeSelect } from "@/components/native-select";
import { enrollStudents, withdrawStudents } from "@/features/academics/enrollment-actions";

type Enrollment = {
  classId: string;
  className: string;
  classCode: string;
  courseTitle: string;
  term: string | null;
  status: "ACTIVE" | "WITHDRAWN" | "COMPLETED";
  since: string;
  ended: string | null;
  note: string | null;
};

const STATUS_LABEL = { ACTIVE: "Enrolled", WITHDRAWN: "Withdrawn", COMPLETED: "Completed" } as const;

export function EnrollmentsPanel({
  studentId,
  enrollments,
  classes,
  canEnroll,
}: {
  studentId: string;
  enrollments: Enrollment[];
  classes: { id: string; label: string; full: boolean }[];
  canEnroll: boolean;
}) {
  const [classId, setClassId] = useState("");
  const [pending, startTransition] = useTransition();
  const enrolledIds = new Set(enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.classId));

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
          <CardDescription>Current and past classes.</CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enrolled in any class yet.</p>
          ) : (
            <ul className="divide-y">
              {enrollments.map((e) => (
                <li key={e.classId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {e.courseTitle} — {e.className}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{e.classCode}</span>
                      {e.term ? ` · ${e.term}` : ""} · {e.since}
                      {e.ended ? ` → ${e.ended}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.status === "ACTIVE" ? "secondary" : "outline"}>{STATUS_LABEL[e.status]}</Badge>
                    {canEnroll && e.status === "ACTIVE" ? (
                      <>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/office/enrollments?classId=${e.classId}`}>Class</Link>
                        </Button>
                        <ConfirmButton
                          variant="ghost"
                          run={() => withdrawStudents({ classId: e.classId, userIds: [studentId] })}
                          label={<><UserMinus /><span className="sr-only">Withdraw from {e.className}</span></>}
                          title={`Withdraw from ${e.className}?`}
                          description="The student loses access to the class. Their history is kept."
                          confirmLabel="Withdraw"
                          destructive
                        />
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canEnroll ? (
        <Card>
          <CardHeader>
            <CardTitle>Enroll in a class</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <label htmlFor="enroll-class" className="sr-only">Class</label>
            <NativeSelect id="enroll-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="min-w-0 flex-1">
              <option value="">Choose a class…</option>
              {classes
                .filter((c) => !enrolledIds.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id} disabled={c.full}>
                    {c.label}
                    {c.full ? " — full" : ""}
                  </option>
                ))}
            </NativeSelect>
            <Button
              disabled={!classId || pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await enrollStudents({ classId, userIds: [studentId] });
                  if (res.status === "error") toast.error(res.message);
                  else if (res.status === "success") {
                    toast.success(res.message ?? "Enrolled.");
                    setClassId("");
                  }
                })
              }
            >
              {pending ? "Enrolling…" : "Enroll"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
