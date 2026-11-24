"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, verifyCode, type CodeState, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  const linkError = useSearchParams().get("error") === "link";

  if (state.status === "sent") {
    return <CodeForm email={state.email} />;
  }

  return (
    <form action={action} className="flex w-full max-w-xs flex-col gap-3">
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
  );
}

function CodeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifyCode.bind(null, email), {
    error: null,
  } as CodeState);

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <p className="text-center" role="status">
        If that email belongs to a member, a sign-in email is on its way. Tap the
        link in it, or enter its code here.
      </p>
      <form action={action} className="flex flex-col gap-3">
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
          placeholder="123456"
          className="min-h-11 rounded-md border border-stone-400 bg-transparent px-3 text-center text-2xl tracking-[0.3em]"
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
      <a href="/login" className="text-center text-sm underline">
        Use a different email
      </a>
    </div>
  );
}
