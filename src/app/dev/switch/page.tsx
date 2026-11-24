import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { devSwitcherEnabled } from "@/lib/dev";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/action-button";
import { signInAs } from "./actions";

export const metadata: Metadata = { title: "Switch account" };

export default function SwitchPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-black uppercase tracking-wide">Switch account</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <SwitchContent />
      </Suspense>
    </main>
  );
}

async function SwitchContent() {
  await connection();
  if (!devSwitcherEnabled) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const currentId = claims?.claims?.sub;

  // The secret-key client reads everyone, including deactivated members.
  const { data: members } = await createAdminClient()
    .from("members")
    .select("id, display_name, role, status")
    .order("display_name")
    .returns<{ id: string; display_name: string; role: string; status: string }[]>();

  return (
    <>
      <p className="rounded-md border border-blaze bg-card p-3 text-sm">
        Local testing only. This page exists only under <code>npm run dev</code> with{" "}
        <code>DEV_ACCOUNT_SWITCHER=on</code> in <code>.env.local</code>. It signs in as
        anyone without an email, against the real Supabase project.
      </p>
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
        {(members ?? []).map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 p-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">
                {m.display_name}
                {m.id === currentId && <span className="font-normal text-muted"> (signed in)</span>}
              </span>
              <span className="text-xs text-muted">
                {m.role === "admin" ? "Admin" : "Member"}
                {m.status === "deactivated" && " · Deactivated"}
              </span>
            </div>
            {m.id !== currentId && (
              <ActionButton
                action={signInAs.bind(null, m.id)}
                label="Sign in as"
                pendingLabel="Signing in…"
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
