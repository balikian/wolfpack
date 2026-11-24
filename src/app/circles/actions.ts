"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireMember } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { circleWriteError, isUuid, parseCircleFields } from "@/lib/circles";

// Every write here runs as the signed-in person, so row-level security
// decides what's allowed: admins manage circles; admins and circle managers
// add and remove people and choose managers; anyone can leave. The database
// refuses to remove a circle's last active manager (P0001 with a message
// meant for people, shown as is).

export type FormResult = { error: string | null };

const LAST_MANAGER = "P0001";

function membershipError(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === LAST_MANAGER && error.message) return error.message;
  return fallback;
}

export async function createCircle(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const me = await requireAdmin();
  const fields = parseCircleFields(formData);
  if (!fields.ok) return { error: fields.error };

  const supabase = await createClient();
  const { data: circle, error } = await supabase
    .from("circles")
    .insert({ name: fields.name, emoji: fields.emoji, kind: fields.kind, created_by: me.id })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: circleWriteError(error) };

  if (formData.get("join") === "on") {
    const { error: joinError } = await supabase
      .from("circle_members")
      .insert({ circle_id: circle.id, member_id: me.id, added_by: me.id, is_manager: true });
    if (joinError) console.error("createCircle: adding creator failed", joinError);
  }

  redirect(`/circles/${circle.id}`);
}

export async function updateCircle(
  circleId: string,
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  if (!isUuid(circleId)) return { error: "That circle doesn't exist." };
  const fields = parseCircleFields(formData);
  if (!fields.ok) return { error: fields.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("circles")
    .update({ name: fields.name, emoji: fields.emoji, kind: fields.kind })
    .eq("id", circleId);
  if (error) return { error: circleWriteError(error) };

  refresh();
  return { error: null };
}

// Deleting a circle deletes its memberships (on delete cascade). Content
// tables added later must also use on delete cascade for circle_id, never
// set null: a null circle_id means Everyone, so set null would expose it.
export async function deleteCircle(circleId: string): Promise<FormResult> {
  await requireAdmin();
  if (!isUuid(circleId)) return { error: "That circle doesn't exist." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circles")
    .delete()
    .eq("id", circleId)
    .select("id");
  if (error) return { error: circleWriteError(error) };
  if (!data?.length) return { error: "Couldn't delete the circle." };

  redirect("/circles");
}

export async function addCircleMember(
  circleId: string,
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const me = await requireMember();
  const memberId = formData.get("member_id");
  if (!isUuid(circleId) || !isUuid(memberId)) return { error: "Pick someone to add." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("circle_members")
    .insert({ circle_id: circleId, member_id: memberId, added_by: me.id });
  if (error) {
    if (error.code === "23505") return { error: "They're already in this circle." };
    return { error: circleWriteError(error) };
  }

  refresh();
  return { error: null };
}

export async function removeCircleMember(
  circleId: string,
  memberId: string,
): Promise<FormResult> {
  await requireMember();
  if (!isUuid(circleId) || !isUuid(memberId)) return { error: "Couldn't remove them." };

  const supabase = await createClient();
  // A delete that row-level security blocks removes nothing rather than
  // failing, so check that a row actually went.
  const { data, error } = await supabase
    .from("circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("member_id", memberId)
    .select("member_id");
  if (error || !data?.length) return { error: membershipError(error, "Couldn't remove them.") };

  refresh();
  return { error: null };
}

export async function setCircleManager(
  circleId: string,
  memberId: string,
  isManager: boolean,
): Promise<FormResult> {
  await requireMember();
  if (!isUuid(circleId) || !isUuid(memberId)) return { error: "Couldn't change that." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circle_members")
    .update({ is_manager: isManager })
    .eq("circle_id", circleId)
    .eq("member_id", memberId)
    .select("member_id");
  if (error || !data?.length) return { error: membershipError(error, "Couldn't change that.") };

  refresh();
  return { error: null };
}

export async function leaveCircle(circleId: string): Promise<FormResult> {
  const me = await requireMember();
  if (!isUuid(circleId)) return { error: "Couldn't leave the circle." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("member_id", me.id)
    .select("member_id");
  if (error || !data?.length) {
    return { error: membershipError(error, "Couldn't leave the circle.") };
  }

  redirect("/circles");
}
