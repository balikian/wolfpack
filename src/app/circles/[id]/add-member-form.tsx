"use client";

import { useActionState } from "react";
import type { FormResult } from "../actions";

/** Pick a member and add them to the circle. */
export function AddMemberForm({
  action,
  people,
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  people: { id: string; display_name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  if (people.length === 0) {
    return <p className="text-sm text-muted">Everyone in the pack is already in this circle.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="member_id">
          Person to add
        </label>
        <select
          id="member_id"
          name="member_id"
          required
          defaultValue=""
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-card px-3 text-base"
        >
          <option value="" disabled>
            Choose someone…
          </option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-forest px-4 font-semibold text-on-forest disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
