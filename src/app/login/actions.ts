"use server";

import { createClient } from "@/lib/supabase/server";
import { findAccountByEmail } from "@/lib/accounts";
import { siteOrigin } from "@/lib/invites";

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

  const supabase = await createClient();
  // shouldCreateUser: false keeps the site invite-only even if the check
  // above were bypassed. Errors are ignored for the same reason as above.
  // The email template links to {{ .RedirectTo }}, so a link requested on
  // localhost opens on localhost. Supabase only accepts redirect URLs on its
  // allow list (URL Configuration) and falls back to the Site URL otherwise.
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });

  return { status: "sent" };
}
