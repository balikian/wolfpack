"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ConfirmState = { error: string | null };

// The only kinds of email link this site sends for signing in.
const ALLOWED_TYPES: EmailOtpType[] = ["email", "magiclink"];

/**
 * Signs in with the token from an emailed link. It runs only when the person
 * presses the button, so mail scanners that open links can't use it up.
 */
export async function confirmSignIn(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;

  if (!tokenHash || !ALLOWED_TYPES.includes(type)) {
    return { error: "This sign-in link isn't valid. Request a new one." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return {
      error: "This sign-in link has expired or was already used. Request a new one.",
    };
  }

  redirect("/");
}
