// Chat types and limits shared by the server and the browser.

/** Which room: the Everyone room, a circle's room or an event's room. */
export type ChatTarget =
  | { room: "everyone" }
  | { room: "circle"; circleId: string }
  | { room: "event"; eventId: string };

export type ChatMessage = {
  id: string;
  room: "everyone" | "circle" | "event";
  circle_id: string | null;
  event_id: string | null;
  author_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

export const CHAT_COLUMNS = "id, room, circle_id, event_id, author_id, body, created_at, deleted_at";
export const CHAT_MAX_LENGTH = 4000;
/** How many recent messages a room loads. */
export const CHAT_PAGE = 200;

/** The Realtime filter for a room (Postgres Changes allow one column). */
export function realtimeFilter(target: ChatTarget): string {
  if (target.room === "circle") return `circle_id=eq.${target.circleId}`;
  if (target.room === "event") return `event_id=eq.${target.eventId}`;
  return "room=eq.everyone";
}

/** Oldest first, one copy of each message, the newest copy winning. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  // Compare as times: Realtime and the REST API may format them differently.
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id),
  );
}
