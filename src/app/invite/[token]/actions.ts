"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken, isWellFormedToken } from "@/lib/invites";

export type AcceptState = { error: string | null };

const USED_OR_EXPIRED =
  "This invite link has expired, was already used, or was cancelled. Ask whoever invited you for a new one.";

export async function acceptInvite(
  token: string,
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 60) {
    return { error: "Enter a name between 1 and 60 characters." };
  }
  if (!isWellFormedToken(token)) return { error: USED_OR_EXPIRED };

  const admin = createAdminClient();

  // Claim the invite in one step, so a link can't be used twice even if it's
  // opened in two tabs at once.
  const { data: invite, error: claimError } = await admin
    .from("invites")
    .update({ status: "accepted" })
    .eq("token_hash", hashInviteToken(token))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id, email")
    .maybeSingle();
  if (claimError) {
    console.error("acceptInvite: claim failed", claimError);
    return { error: "Something went wrong. Try the link again in a minute." };
  }
  if (!invite) return { error: USED_OR_EXPIRED };

  try {
    // Create their sign-in account (already exists if they were a member
    // before and an admin invited them back).
    const created = await admin.auth.admin.createUser({
      email: invite.email,
      email_confirm: true,
    });
    if (created.error && created.error.code !== "email_exists") throw created.error;

    // A one-time sign-in token for that account. Nothing is emailed.
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: invite.email,
    });
    if (link.error) throw link.error;
    const userId = link.data.user.id;

    // Re-invited after being deactivated: allow sign-in again.
    const unban = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (unban.error) throw unban.error;

    const { error: memberError } = await admin
      .from("members")
      .upsert({ id: userId, display_name: name, status: "active" }, { onConflict: "id" });
    if (memberError) throw memberError;

    const { error: linkError } = await admin
      .from("invites")
      .update({ accepted_by: userId })
      .eq("id", invite.id);
    if (linkError) throw linkError;

    // Sign them in on this device.
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.data.properties.hashed_token,
    });
    if (verifyError) throw verifyError;
  } catch (err) {
    console.error("acceptInvite failed; reopening the invite", err);
    await admin.from("invites").update({ status: "pending" }).eq("id", invite.id);
    return { error: "Something went wrong. Try the link again in a minute." };
  }

  redirect("/");
}
