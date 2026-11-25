import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CHAT_COLUMNS, CHAT_PAGE, type ChatMessage, type ChatTarget } from "@/lib/chat-types";

/**
 * The most recent messages in a room, oldest first. Row-level security
 * returns nothing for a room this person can't see.
 */
export async function loadChat(target: ChatTarget): Promise<{ messages: ChatMessage[]; more: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("chat_messages")
    .select(CHAT_COLUMNS)
    .eq("room", target.room);
  if (target.room === "circle") query = query.eq("circle_id", target.circleId);
  if (target.room === "event") query = query.eq("event_id", target.eventId);

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE + 1)
    .returns<ChatMessage[]>();
  const rows = data ?? [];
  return { messages: rows.slice(0, CHAT_PAGE).reverse(), more: rows.length > CHAT_PAGE };
}

/** Display names by member id, for labelling messages. */
export function nameMap(members: { id: string; display_name: string }[]): Record<string, string> {
  return Object.fromEntries(members.map((m) => [m.id, m.display_name]));
}
