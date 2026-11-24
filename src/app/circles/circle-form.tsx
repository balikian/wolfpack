"use client";

import { useActionState } from "react";
import type { FormResult } from "./actions";

type Fields = { name: string; emoji: string | null; kind: "open" | "secret" };

const input =
  "min-h-11 rounded-md border border-line bg-card px-3 text-base font-normal";

/** Create a circle (no `initial`) or edit one. */
export function CircleForm({
  action,
  initial,
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  initial?: Fields;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const editing = Boolean(initial);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Opening a secret circle shows everyone that it exists and who's in it.
        const kind = new FormData(e.currentTarget).get("kind");
        if (
          initial?.kind === "secret" &&
          kind === "open" &&
          !window.confirm(
            "Make this circle open? Every member will see it and who's in it. What's shared in it stays limited to its members.",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex gap-2">
        <label className="flex w-20 flex-col gap-1 text-sm font-semibold">
          Emoji
          <input
            name="emoji"
            defaultValue={initial?.emoji ?? ""}
            maxLength={16}
            autoComplete="off"
            placeholder="🍄"
            className={`${input} text-center`}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
          Name
          <input
            name="name"
            required
            maxLength={40}
            defaultValue={initial?.name ?? ""}
            autoComplete="off"
            placeholder="Mushroom crew"
            className={input}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Who knows it exists</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="kind"
            value="secret"
            defaultChecked={(initial?.kind ?? "secret") === "secret"}
            className="mt-1"
          />
          <span>
            <strong>Secret.</strong>{" "}
            <span className="text-muted">Only people in it can see it.</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="kind"
            value="open"
            defaultChecked={initial?.kind === "open"}
            className="mt-1"
          />
          <span>
            <strong>Open.</strong>{" "}
            <span className="text-muted">
              Every member can see it and who&apos;s in it. What&apos;s shared in
              it is still for its members only.
            </span>
          </span>
        </label>
      </fieldset>

      {!editing && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="join" defaultChecked />
          Add me to this circle
        </label>
      )}

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-blaze px-4 font-semibold text-on-blaze disabled:opacity-60"
      >
        {pending ? "Saving…" : editing ? "Save changes" : "Create circle"}
      </button>
    </form>
  );
}
