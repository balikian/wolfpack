"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  const linkError = useSearchParams().get("error") === "link";

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        {linkError && (
          <p className="text-sm text-amber-300" role="alert">
            That sign-in link has expired or was already used. Request a new one.
          </p>
        )}
        <label htmlFor="email" className="text-sm font-semibold uppercase tracking-wide">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="min-h-11 rounded-md border border-stone-400 bg-transparent px-3 text-base"
        />
        {state.status === "invalid" && (
          <p className="text-sm text-amber-300" role="alert">
            Enter a valid email address.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-orange-600 px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      <Link href="/login/code" className="text-center text-sm underline">
        Already have a code? Enter it here
      </Link>
    </div>
  );
}
