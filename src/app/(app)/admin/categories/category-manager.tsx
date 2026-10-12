"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { deleteCategory, saveCategory } from "@/features/academics/structure-actions";
import { useActionForm } from "@/hooks/use-action-form";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ActionState } from "@/lib/actions";

type Category = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  depth: number;
  courseCount: number;
};

const initial: ActionState = { status: "idle" };

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader>
          <CardTitle>All categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <ul className="divide-y">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <span style={{ paddingLeft: `${c.depth * 1.25}rem` }}>
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.courseCount} course{c.courseCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                      <Pencil />
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      run={() => deleteCategory({ id: c.id })}
                      label={<><Trash2 /><span className="sr-only">Delete {c.name}</span></>}
                      title={`Delete “${c.name}”?`}
                      description="Only empty categories (no courses or subcategories) can be deleted."
                      confirmLabel="Delete"
                      destructive
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <CategoryForm
        key={editing?.id ?? "new"}
        category={editing}
        categories={categories}
        onDone={() => setEditing(null)}
      />
    </div>
  );
}

function CategoryForm({
  category,
  categories,
  onDone,
}: {
  category: Category | null;
  categories: Category[];
  onDone: () => void;
}) {
  const { state, formAction, onSubmit, pending } = useActionForm(saveCategory, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  useActionToast(state, onDone);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{category ? `Edit “${category.name}”` : "New category"}</CardTitle>
        {category ? <CardDescription>Changes apply to all its courses.</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <form action={formAction} onSubmit={onSubmit} className="grid gap-4" noValidate>
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <FormField id="cat-name" label="Name" error={errors?.name}>
            <Input id="cat-name" name="name" defaultValue={category?.name} />
          </FormField>
          <FormField id="cat-parent" label="Parent" error={errors?.parentId}>
            <NativeSelect id="cat-parent" name="parentId" defaultValue={category?.parentId ?? ""}>
              <option value="">None (top level)</option>
              {categories
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {"— ".repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField id="cat-description" label="Description" error={errors?.description} hint="Optional.">
            <Input id="cat-description" name="description" defaultValue={category?.description ?? ""} />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : category ? "Save category" : "Create category"}
            </Button>
            {category ? (
              <Button type="button" variant="ghost" onClick={onDone}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
