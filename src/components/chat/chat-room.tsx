"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CHAT_COLUMNS,
  CHAT_MAX_LENGTH,
  CHAT_PAGE,
  mergeMessages,
  realtimeFilter,
  type ChatMessage,
  type ChatTarget,
} from "@/lib/chat-types";
import { formatDay, formatTime } from "@/lib/time";
import { deleteChatMessage, sendChatMessage } from "@/app/chat/actions";

// Messages from the same person within this long share one name line.
const GROUP_MS = 5 * 60 * 1000;

/**
 * A live chat room. It starts with the messages the server loaded, then
 * listens for new and deleted ones through Supabase Realtime, which only
 * delivers rows this person's row-level security lets them read.
 */
export function ChatRoom({
  target,
  initial,
  more,
  names,
  meId,
  isAdmin,
  nowIso,
  emptyText,
  tall = false,
}: {
  target: ChatTarget;
  initial: ChatMessage[];
  more: boolean;
  names: Record<string, string>;
  meId: string;
  isAdmin: boolean;
  nowIso: string;
  emptyText: string;
  tall?: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const [sending, startSending] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const forceScroll = useRef(true);
  const now = new Date(nowIso);
  const filter = realtimeFilter(target);

  // Fetch the latest messages again, to catch anything missed while the
  // connection was down (phones drop it when the screen is off).
  const catchUp = useEffectEvent(async () => {
    const supabase = createClient();
    let query = supabase.from("chat_messages").select(CHAT_COLUMNS).eq("room", target.room);
    if (target.room === "circle") query = query.eq("circle_id", target.circleId);
    if (target.room === "event") query = query.eq("event_id", target.eventId);
    const { data } = await query
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE)
      .returns<ChatMessage[]>();
    if (data) setMessages((current) => mergeMessages(current, data));
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${filter}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setMessages((current) => mergeMessages(current, [payload.new as ChatMessage]));
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLive("live");
          void catchUp();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLive("offline");
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void catchUp();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [filter]);

  // Keep the newest message in view, unless the person scrolled up to read.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && (nearBottom.current || forceScroll.current)) el.scrollTop = el.scrollHeight;
    forceScroll.current = false;
  }, [messages]);

  function onScroll() {
    const el = list.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    startSending(async () => {
      const result = await sendChatMessage(target, text);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      forceScroll.current = true;
      setMessages((current) => mergeMessages(current, [result.message]));
      setDraft("");
    });
  }

  async function remove(m: ChatMessage) {
    const mine = m.author_id === meId;
    if (!window.confirm(mine ? "Delete your message?" : `Delete ${names[m.author_id ?? ""] ?? "this"}'s message?`)) {
      return;
    }
    const result = await deleteChatMessage(m.id);
    if (result.error) setError(result.error);
    else if (result.message) setMessages((current) => mergeMessages(current, [result.message!]));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={list}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className={`flex flex-col overflow-y-auto rounded-md border border-line bg-card p-3 ${tall ? "h-[60dvh]" : "max-h-96 min-h-32"}`}
      >
        {more && (
          <p className="pb-2 text-center text-xs text-muted">
            Showing the latest {CHAT_PAGE} messages.
          </p>
        )}
        {messages.length === 0 && <p className="m-auto text-center text-muted">{emptyText}</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const day = formatDay(m.created_at, now);
          const newDay = !prev || formatDay(prev.created_at, now) !== day;
          const grouped =
            !newDay &&
            prev.author_id === m.author_id &&
            Date.parse(m.created_at) - Date.parse(prev.created_at) < GROUP_MS;
          const mine = m.author_id === meId;
          const canDelete = !m.deleted_at && (mine || isAdmin);
          return (
            <div key={m.id} className="flex flex-col">
              {newDay && (
                <p className="py-2 text-center text-xs font-bold uppercase tracking-wider text-muted">
                  {day}
                </p>
              )}
              <div className={`group flex flex-col ${mine ? "items-end" : "items-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                {!grouped && (
                  <p className="px-1 text-xs text-muted">
                    <span className="font-semibold">
                      {mine ? "You" : (names[m.author_id ?? ""] ?? "Someone")}
                    </span>{" "}
                    · {formatTime(m.created_at)}
                  </p>
                )}
                <div className={`flex max-w-[85%] items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                  {m.deleted_at ? (
                    <p className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm italic text-muted">
                      Message deleted
                    </p>
                  ) : (
                    <p
                      className={`whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 ${
                        mine ? "bg-forest text-on-forest" : "border border-line"
                      }`}
                    >
                      <Linked text={m.body} />
                    </p>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      className="shrink-0 rounded px-1 text-xs text-muted underline opacity-60 hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Delete message"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor={`chat-${filter}`} className="sr-only">
          Message
        </label>
        <textarea
          id={`chat-${filter}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter starts a new line.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={Math.min(5, Math.max(1, draft.split("\n").length))}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Write a message…"
          className="min-h-11 flex-1 resize-none rounded-md border border-line bg-card px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="min-h-11 rounded-md bg-blaze px-4 font-semibold text-on-blaze disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {live === "offline" && (
        <p className="text-xs text-muted">
          Live updates paused. New messages will show when the connection comes back, or reload the page.
        </p>
      )}
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]}'])/g;

/** Message text with web links made tappable. */
function Linked({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
