"use client";
/** Form bound to a server action, with pending state and inline result message. */
import clsx from "clsx";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "./ui";

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  resetOnSuccess = false,
  submitVariant = "primary",
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  submitVariant?: "primary" | "secondary" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={clsx("space-y-3", className)}>
      {/* Browser timezone offset so datetime-local values are interpreted correctly on the server. */}
      <TzField />
      {children}
      {state?.fieldErrors && (
        <ul className="text-sm text-bad">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>
              <b>{k}</b>: {v.join(", ")}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} variant={submitVariant}>
          {pending ? "Working…" : submitLabel}
        </Button>
        {state?.message && (
          <span role="status" className={clsx("text-sm", state.ok ? "text-good" : "text-bad")}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function TzField() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = String(new Date().getTimezoneOffset());
  }, []);
  return <input ref={ref} type="hidden" name="tz" defaultValue="0" />;
}
