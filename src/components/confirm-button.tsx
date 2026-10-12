"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";

/**
 * A button that asks for confirmation, then runs a Server Action (`command`) and toasts the result.
 * Pass `onSuccess` to react to returned data (e.g. show a generated link).
 */
export function ConfirmButton<T>({
  run,
  label,
  title,
  description,
  confirmLabel,
  variant = "outline",
  destructive = false,
  disabled = false,
  onSuccess,
}: {
  run: () => Promise<ActionState<T>>;
  label: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  destructive?: boolean;
  disabled?: boolean;
  onSuccess?: (data: T | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} disabled={pending || disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await run();
                setOpen(false);
                if (!result) return; // the action redirected
                if (result.status === "error") toast.error(result.message);
                else if (result.status === "success") {
                  if (result.message) toast.success(result.message);
                  onSuccess?.(result.data);
                }
              });
            }}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
