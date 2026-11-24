"use server";

import { redirect } from "next/navigation";
import { devSwitcherEnabled } from "@/lib/dev";
import { isUuid } from "@/lib/circles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SwitchResult = { error: string | null };

/** Signs in as a member without sending an email. Local testing only. */
export async function signInAs(memberId: string): Promise<SwitchResult> {
  if (!devSwitcherEnabled) return { error: "The account switcher is off." };
  if (!isUuid(memberId)) return { error: "Unknown member." };

  const admin = createAdminClient();
  const { data: user, error: userError } = await admin.auth.admin.getUserById(memberId);
  if (userError || !user.user?.email) return { error: "Couldn't find that account." };

  // Make a one-time sign-in token (no email is sent) and use it right away.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.user.email,
  });
  if (linkError || !link.properties?.hashed_token) {
    return { error: "Couldn't make a sign-in token." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (error) {
    return {
      error: error.code === "user_banned" ? "That account is deactivated." : "Sign-in failed.",
    };
  }

  redirect("/");
}
