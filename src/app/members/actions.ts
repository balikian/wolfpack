"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccountByEmail } from "@/lib/accounts";
import { escapeHtml, sendEmail } from "@/lib/email";
import { newInviteToken, normalizeEmail, siteOrigin } from "@/lib/invites";

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "created"; email: string; link: string; emailed: boolean };

export type ActionResult = { error: string | null };

// About 100 years: Supabase's way of blocking sign-in indefinitely.
const BAN_FOREVER = "876000h";

/**
 * Creates an invite, emails it, and returns its link. Inviting an email that
 * already has a pending invite cancels the old link, so this also serves as
 * "resend". The link is shown once; only its hash is stored.
 */
export async function createInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const me = await requireAdmin();
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { status: "error", message: "Enter a valid email address." };

  const { account, error: lookupError } = await findAccountByEmail(email);
  if (lookupError) {
    return { status: "error", message: "Couldn't create the invite. Try again." };
  }
  if (account?.memberStatus === "active") {
    return { status: "error", message: `${email} is already a member.` };
  }

  // Everything below runs as the signed-in admin, so row-level security
  // checks it again.
  const supabase = await createClient();
  const { error: revokeError } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("email", email)
    .eq("status", "pending");
  if (revokeError) {
    console.error("createInvite: revoke old invite failed", revokeError);
    return { status: "error", message: "Couldn't create the invite. Try again." };
  }

  const { token, tokenHash } = newInviteToken();
  const { error } = await supabase
    .from("invites")
    .insert({ email, invited_by: me.id, token_hash: tokenHash });
  if (error) {
    console.error("createInvite: insert failed", error);
    return { status: "error", message: "Couldn't create the invite. Try again." };
  }

  const link = `${await siteOrigin()}/invite/${token}`;
  const emailed = await sendEmail(inviteEmail(email, me.display_name, link));

  refresh();
  return { status: "created", email, link, emailed };
}

function inviteEmail(to: string, inviter: string, link: string) {
  const name = escapeHtml(inviter);
  return {
    to,
    subject: `${inviter} invited you to Wolfpack`,
    html: `<h2>You're invited to Wolfpack</h2>
<p>${name} invited you to join Wolfpack, our private site for planning hikes, parties and get-togethers.</p>
<p><a href="${link}">Join the pack</a></p>
<p>The link works once and expires in 7 days.</p>`,
    text: `${inviter} invited you to join Wolfpack, our private site for planning hikes, parties and get-togethers.

Join here: ${link}

The link works once and expires in 7 days.`,
  };
}

export async function revokeInvite(
  inviteId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("status", "pending");
  if (error) return { error: "Couldn't cancel the invite." };
  refresh();
  return { error: null };
}

export async function setMemberRole(
  memberId: string,
  role: "admin" | "member",
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  // The database function re-checks that the caller is an admin and refuses
  // to remove the last admin.
  const { error } = await supabase.rpc("admin_set_member_role", {
    target: memberId,
    new_role: role,
  });
  if (error) return { error: error.message };
  refresh();
  return { error: null };
}

export async function setMemberStatus(
  memberId: string,
  status: "active" | "deactivated",
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  // Database rules first: admin check, can't deactivate yourself or the last
  // admin. Access to data stops as soon as this succeeds.
  const { error } = await supabase.rpc("admin_set_member_status", {
    target: memberId,
    new_status: status,
  });
  if (error) return { error: error.message };

  // Then block (or unblock) sign-in, which also stops their sessions from
  // refreshing. Existing sessions already can't read anything.
  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(memberId, {
    ban_duration: status === "deactivated" ? BAN_FOREVER : "none",
  });
  if (banError) {
    console.error("setMemberStatus: ban update failed", banError);
    refresh();
    return {
      error:
        status === "deactivated"
          ? "Deactivated, but blocking their sign-in failed. Try again."
          : "Reactivated, but unblocking their sign-in failed. Try again.",
    };
  }

  refresh();
  return { error: null };
}
