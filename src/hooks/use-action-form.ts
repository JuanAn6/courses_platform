"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState for forms, without React's automatic form reset after each submission
 * (which would wipe the user's input when validation fails). Spread both handlers on the form:
 * `<form action={formAction} onSubmit={onSubmit}>`; the native `action` still works without JS.
 */
export function useActionForm<S>(
  action: (prev: Awaited<S>, formData: FormData) => S | Promise<S>,
  initial: Awaited<S>,
) {
  const [state, formAction, pending] = useActionState(action, initial);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };

  return { state, formAction, onSubmit, pending };
}
