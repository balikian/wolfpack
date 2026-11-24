"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { findAccountByEmail } from "@/lib/accounts";

export type LoginState = { status: "idle" | "sent" | "invalid" };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "invalid" };
  }

  // Email a link only to active members. Unknown and deactivated addresses
  // get the same "sent" screen, so it never reveals who is a member.
  const { account } = await findAccountByEmail(email);
  if (account?.memberStatus !== "active") return { status: "sent" };

  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  const supabase = await createClient();
  // shouldCreateUser: false keeps the site invite-only even if the check
  // above were bypassed. Errors are ignored for the same reason as above.
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  return { status: "sent" };
}
