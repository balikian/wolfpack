"use server";

import { requireMember } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/circles";
import {
  CHAT_COLUMNS,
  CHAT_MAX_LENGTH,
  type ChatMessage,
  type ChatTarget,
} from "@/lib/chat-types";

// Writes run as the signed-in person, so row-level security decides who can
// post in a room and who can delete a message.

export type SendResult = { message: ChatMessage; error: null } | { message: null; error: string };

export async function sendChatMessage(target: ChatTarget, text: string): Promise<SendResult> {
  const me = await requireMember();
  const body = String(text ?? "").trim();
  if (!body) return { message: null, error: "Type a message first." };
  if (body.length > CHAT_MAX_LENGTH) {
    return { message: null, error: `Keep messages under ${CHAT_MAX_LENGTH.toLocaleString()} characters.` };
  }

  let row: { room: string; circle_id: string | null; event_id: string | null };
  if (target?.room === "everyone") {
    row = { room: "everyone", circle_id: null, event_id: null };
  } else if (target?.room === "circle" && isUuid(target.circleId)) {
    row = { room: "circle", circle_id: target.circleId, event_id: null };
  } else if (target?.room === "event" && isUuid(target.eventId)) {
    row = { room: "event", circle_id: null, event_id: target.eventId };
  } else {
    return { message: null, error: "That chat doesn't exist." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ ...row, author_id: me.id, body })
    .select(CHAT_COLUMNS)
    .single<ChatMessage>();
  if (error) {
    if (error.code === "42501") return { message: null, error: "You can't post in this chat." };
    console.error("sendChatMessage failed", error);
    return { message: null, error: "Couldn't send. Try again." };
  }
  return { message: data, error: null };
}

export type DeleteResult = { message: ChatMessage | null; error: string | null };

export async function deleteChatMessage(messageId: string): Promise<DeleteResult> {
  await requireMember();
  if (!isUuid(messageId)) return { message: null, error: "That message doesn't exist." };

  const supabase = await createClient();
  // The database blanks the text and stamps the time.
  const { data, error } = await supabase
    .from("chat_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("deleted_at", null)
    .select(CHAT_COLUMNS)
    .returns<ChatMessage[]>();
  if (error) {
    console.error("deleteChatMessage failed", error);
    return { message: null, error: "Couldn't delete the message." };
  }
  if (!data?.length) return { message: null, error: "Only the person who wrote it or an admin can delete it." };
  return { message: data[0], error: null };
}
