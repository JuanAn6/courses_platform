"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { deleteTerm, saveTerm } from "@/features/academics/structure-actions";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";

type Term = { id: string; name: string; startDate: string; endDate: string; classCount: number };

const initial: ActionState = { status: "idle" };

export function TermManager({ terms }: { terms: Term[] }) {
  const [editing, setEditing] = useState<Term | null>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Term</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Classes</TableHead>
              <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No terms yet.</TableCell>
              </TableRow>
            ) : (
              terms.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{t.startDate} → {t.endDate}</TableCell>
                  <TableCell className="tabular-nums">{t.classCount}</TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}>
                        <Pencil />
                      </Button>
                      <ConfirmButton
                        variant="ghost"
                        run={() => deleteTerm({ id: t.id })}
                        label={<><Trash2 /><span className="sr-only">Delete {t.name}</span></>}
                        title={`Delete “${t.name}”?`}
                        description="Only terms without classes can be deleted."
                        confirmLabel="Delete"
                        destructive
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TermForm key={editing?.id ?? "new"} term={editing} onDone={() => setEditing(null)} />
    </div>
  );
}

function TermForm({ term, onDone }: { term: Term | null; onDone: () => void }) {
  const { state, formAction, onSubmit, pending } = useActionForm(saveTerm, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  useActionToast(state, onDone);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{term ? `Edit “${term.name}”` : "New term"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
          {term ? <input type="hidden" name="id" value={term.id} /> : null}
          <FormField id="term-name" label="Name" error={errors?.name} hint="e.g. 2026 Fall">
            <Input id="term-name" name="name" defaultValue={term?.name} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="term-start" label="Starts" error={errors?.startDate}>
              <Input id="term-start" name="startDate" type="date" defaultValue={term?.startDate} />
            </FormField>
            <FormField id="term-end" label="Ends" error={errors?.endDate}>
              <Input id="term-end" name="endDate" type="date" defaultValue={term?.endDate} />
            </FormField>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : term ? "Save term" : "Create term"}</Button>
            {term ? <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
