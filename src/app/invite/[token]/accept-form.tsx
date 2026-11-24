"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptState } from "./actions";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(
    acceptInvite.bind(null, token),
    { error: null } as AcceptState,
  );

  return (
    <form action={action} className="flex w-full max-w-xs flex-col gap-3">
      <p className="text-sm opacity-80">
        Joining as <strong>{email}</strong>. You&apos;ll sign in with links sent
        to this address; there&apos;s no password.
      </p>
      <label htmlFor="name" className="text-sm font-semibold uppercase tracking-wide">
        Your name
      </label>
      <input
        id="name"
        name="name"
        required
        maxLength={60}
        autoComplete="name"
        placeholder="What the pack calls you"
        className="min-h-11 rounded-md border border-on-forest/50 bg-transparent px-3 text-base"
      />
      {state.error && (
        <p className="text-sm text-amber-300" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-blaze px-4 font-semibold text-on-blaze disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join the pack"}
      </button>
    </form>
  );
}
