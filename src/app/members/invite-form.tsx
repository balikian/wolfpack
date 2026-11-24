"use client";

import { useActionState, useState } from "react";
import { createInvite, type InviteState } from "./actions";

const initial: InviteState = { status: "idle" };

/** Invite by email. Also used with a fixed email as a pending invite's "New link" button. */
export function InviteForm({ fixedEmail }: { fixedEmail?: string }) {
  const [state, action, pending] = useActionState(createInvite, initial);

  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        {fixedEmail ? (
          <input type="hidden" name="email" value={fixedEmail} />
        ) : (
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
            Friend&apos;s email
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="friend@example.com"
              className="min-h-11 rounded-md border border-line bg-card px-3 text-base font-normal"
            />
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className={
            fixedEmail
              ? "min-h-9 rounded-md border border-line px-3 text-sm font-semibold disabled:opacity-60"
              : "min-h-11 rounded-md bg-blaze px-4 font-semibold text-on-blaze disabled:opacity-60"
          }
        >
          {pending ? "Sending…" : fixedEmail ? "Resend invite" : "Send invite"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      )}
      {state.status === "created" && (
        <NewLink email={state.email} link={state.link} emailed={state.emailed} />
      )}
    </div>
  );
}

function NewLink({
  email,
  link,
  emailed,
}: {
  email: string;
  link: string;
  emailed: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm" role="status">
      {emailed ? (
        <p>
          Invite emailed to <strong>{email}</strong>. If it doesn&apos;t arrive,
          send them this link yourself. It works once and expires in 7 days.
          This is the only time it&apos;s shown.
        </p>
      ) : (
        <p>
          <strong>Couldn&apos;t email the invite.</strong> Send this link to{" "}
          <strong>{email}</strong> yourself. It works once and expires in 7
          days. This is the only time it&apos;s shown.
        </p>
      )}
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-9 min-w-0 flex-1 rounded-md border border-line bg-paper px-2 font-mono text-xs"
          aria-label="Invite link"
        />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
          className="min-h-9 rounded-md bg-forest px-3 font-semibold text-on-forest"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
