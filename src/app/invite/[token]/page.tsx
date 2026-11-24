import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken, isWellFormedToken } from "@/lib/invites";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "You're invited" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-forest px-4 text-on-forest">
      <h1 className="text-4xl font-black uppercase tracking-widest">Wolfpack</h1>
      <Suspense fallback={<p>Checking your invite…</p>}>
        <InviteContent params={params} />
      </Suspense>
    </main>
  );
}

async function InviteContent({ params }: { params: Promise<{ token: string }> }) {
  // Invites depend on the current time (expiry), so always render at request time.
  await connection();
  const { token } = await params;
  const invite = isWellFormedToken(token) ? await findOpenInvite(token) : null;

  if (!invite) {
    return (
      <p className="max-w-xs text-center">
        This invite link has expired, was already used, or was cancelled. Ask
        whoever invited you for a new one.
      </p>
    );
  }

  return (
    <>
      <p className="text-center">You&apos;re invited to join the pack.</p>
      <AcceptForm token={token} email={invite.email} />
    </>
  );
}

// Visitors here aren't signed in yet, so this lookup uses the secret key. It
// only ever matches the one invite whose token is in the URL.
async function findOpenInvite(token: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invites")
    .select("email")
    .eq("token_hash", hashInviteToken(token))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ email: string }>();
  return data;
}
