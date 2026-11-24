"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findAccountByEmail } from "@/lib/accounts";
import { siteOrigin } from "@/lib/invites";

export type LoginState =
  | { status: "idle" | "invalid" }
  | { status: "sent"; email: string };

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
  if (account?.memberStatus !== "active") return { status: "sent", email };

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

  return { status: "sent", email };
}

export type CodeState = { error: string | null };

/**
 * Signs in with the code from the sign-in email, for when opening the link
 * isn't handy (mail on another device, or the site saved to a phone's home
 * screen, which email links can't open).
 */
export async function verifyCode(
  email: string,
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(code)) return { error: "Enter the code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    if (error.code === "user_banned") {
      return { error: "This account no longer has access. Ask an admin if that's a mistake." };
    }
    return { error: "That code didn't work. It may have expired; request a new one." };
  }

  redirect("/");
}
