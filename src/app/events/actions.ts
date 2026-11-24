"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/circles";
import { parseEventForm, type RsvpStatus } from "@/lib/events";

// Every write runs as the signed-in person, so row-level security decides:
// anyone can post to Everyone or to a circle they're in; the creator and
// admins edit and delete; each person sets only their own RSVP.

export type FormResult = { error: string | null };

function writeError(error: { code?: string }): string {
  if (error.code === "42501") {
    return "You can't post to that circle. Pick Everyone or a circle you're in.";
  }
  return "Couldn't save the event. Try again.";
}

export async function createEvent(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireMember();
  const parsed = parseEventForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...parsed.fields, created_by: me.id })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    console.error("createEvent failed", error);
    return { error: writeError(error) };
  }

  // The person who made it is going, unless they change it.
  await supabase
    .from("event_rsvps")
    .insert({ event_id: data.id, member_id: me.id, status: "going" });

  redirect(`/events/${data.id}`);
}

export async function updateEvent(
  eventId: string,
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireMember();
  if (!isUuid(eventId)) return { error: "That event doesn't exist." };
  const parsed = parseEventForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update(parsed.fields)
    .eq("id", eventId)
    .select("id");
  if (error) {
    console.error("updateEvent failed", error);
    return { error: writeError(error) };
  }
  if (!data?.length) return { error: "Only the person who made this event or an admin can edit it." };

  redirect(`/events/${eventId}`);
}

export async function deleteEvent(eventId: string): Promise<FormResult> {
  await requireMember();
  if (!isUuid(eventId)) return { error: "That event doesn't exist." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error || !data?.length) return { error: "Couldn't delete the event." };

  redirect("/events");
}

export async function setRsvp(eventId: string, status: RsvpStatus): Promise<FormResult> {
  const me = await requireMember();
  if (!isUuid(eventId) || !["going", "maybe", "no"].includes(status)) {
    return { error: "Couldn't save your answer." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_rsvps")
    .upsert(
      { event_id: eventId, member_id: me.id, status },
      { onConflict: "event_id,member_id" },
    );
  if (error) {
    console.error("setRsvp failed", error);
    return { error: "Couldn't save your answer." };
  }

  refresh();
  return { error: null };
}
