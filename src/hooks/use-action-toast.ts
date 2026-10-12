"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/actions";

/**
 * Shows a toast for each new ActionState exactly once and runs `onSuccess`.
 * Field errors are left to the form (no toast). Pass `toastErrors: false` when the form
 * already shows its general error inline.
 */
export function useActionToast<T>(
  state: ActionState<T>,
  onSuccess?: (state: ActionState<T> & { status: "success" }) => void,
  { toastErrors = true }: { toastErrors?: boolean } = {},
) {
  const handled = useRef(state);
  const callback = useRef(onSuccess);
  useLayoutEffect(() => {
    callback.current = onSuccess;
  });

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      callback.current?.(state);
    } else if (state.status === "error" && !state.fieldErrors && toastErrors) {
      toast.error(state.message);
    }
  }, [state, toastErrors]);
}
