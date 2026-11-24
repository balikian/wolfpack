"use client";

import { useActionState } from "react";

type Result = { error: string | null };

/** A one-button form for a bound server action, showing its error if any. */
export function ActionButton({
  action,
  label,
  pendingLabel = "Working…",
  confirmText,
  variant = "plain",
}: {
  action: (prev: Result) => Promise<Result>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  variant?: "plain" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        className={`min-h-9 rounded-md border px-3 text-sm font-semibold disabled:opacity-60 ${
          variant === "danger" ? "border-danger text-danger" : "border-line"
        }`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p className="max-w-56 text-right text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
