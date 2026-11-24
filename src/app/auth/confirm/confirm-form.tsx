"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { confirmSignIn, type ConfirmState } from "./actions";

const initial: ConfirmState = { error: null };

export function ConfirmForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(confirmSignIn, initial);
  const tokenHash = params.get("token_hash") ?? "";
  const type = params.get("type") ?? "";

  if (!tokenHash) {
    return (
      <p className="max-w-xs text-center">
        This sign-in link is incomplete.{" "}
        <Link href="/login" className="underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-xs flex-col gap-3">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-blaze px-4 font-semibold text-on-blaze disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in to Wolfpack"}
      </button>
      {state.error && (
        <p className="text-sm text-amber-300" role="alert">
          {state.error}{" "}
          <Link href="/login" className="underline">
            Back to sign-in
          </Link>
        </p>
      )}
    </form>
  );
}
