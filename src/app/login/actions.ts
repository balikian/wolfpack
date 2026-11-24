"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  const supabase = await createClient();
  // shouldCreateUser: false keeps the site invite-only. Unknown emails get an
  // error from Supabase, which is deliberately ignored: the screen says the
  // same thing either way, so it never reveals who is a member.
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  return { status: "sent" };
}
