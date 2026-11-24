"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyCode, type CodeState } from "../actions";

const initial: CodeState = { error: null };

const field =
  "min-h-11 rounded-md border border-stone-400 bg-transparent px-3";

/**
 * The email arrives in the URL after "Email me a sign-in link", so this page
 * survives a refresh or a trip to the mail app. Opened from the sign-in page's
 * "Already have a code?" link, it asks for the email too.
 */
export function CodeForm() {
  const [state, action, pending] = useActionState(verifyCode, initial);
  const sentTo = useSearchParams().get("email")?.trim() ?? "";

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      {sentTo ? (
        <p className="text-center" role="status">
          If <strong className="break-all">{sentTo}</strong> belongs to a member, a
          sign-in email is on its way. Tap the link in it, or enter its code here.
        </p>
      ) : (
        <p className="text-center">Enter your email and the code from your sign-in email.</p>
      )}
      <form
        // Submitted by hand so a wrong code doesn't wipe what was typed.
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
        className="flex flex-col gap-3"
      >
        {sentTo ? (
          <input type="hidden" name="email" value={sentTo} />
        ) : (
          <>
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
              className={`${field} text-base`}
            />
          </>
        )}
        <label htmlFor="code" className="text-sm font-semibold uppercase tracking-wide">
          Code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          required
          autoFocus={Boolean(sentTo)}
          placeholder="123456"
          className={`${field} text-center text-2xl tracking-[0.3em]`}
        />
        {state.error && (
          <p className="text-sm text-amber-300" role="alert">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-orange-600 px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Link href="/login" className="text-center text-sm underline">
        {sentTo ? "Use a different email" : "Back to sign-in"}
      </Link>
    </div>
  );
}
