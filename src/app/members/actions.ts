"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newInviteToken, normalizeEmail, siteOrigin } from "@/lib/invites";

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "created"; email: string; link: string };

export type ActionResult = { error: string | null };

// About 100 years: Supabase's way of blocking sign-in indefinitely.
const BAN_FOREVER = "876000h";

/**
 * Creates an invite and returns its link. Inviting an email that already has
 * a pending invite cancels the old link, so this also serves as "resend".
 * The link is shown once; only its hash is stored.
 */
export async function createInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const me = await requireAdmin();
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { status: "error", message: "Enter a valid email address." };

  // Already an active member? (There are only a few dozen accounts, so one
  // page of users covers everyone.)
  const admin = createAdminClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    console.error("createInvite: listUsers failed", listError);
    return { status: "error", message: "Couldn't create the invite. Try again." };
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    const { data: row } = await admin
      .from("members")
      .select("status")
      .eq("id", existing.id)
      .maybeSingle();
    if (row?.status === "active") {
      return { status: "error", message: `${email} is already a member.` };
    }
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

  refresh();
  return {
    status: "created",
    email,
    link: `${await siteOrigin()}/invite/${token}`,
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
