import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { loadChat, nameMap } from "@/lib/chat";
import { ChatRoom } from "@/components/chat/chat-room";

export const metadata: Metadata = { title: "Pack chat" };

export default function ChatPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <nav>
        <Link href="/" className="text-sm font-semibold underline">
          ‹ Home
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-black uppercase tracking-wide">Pack chat</h1>
        <p className="text-sm text-muted">
          Everyone in the pack can read this. Each event and circle has its own chat too.
        </p>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <EveryoneRoom />
      </Suspense>
    </main>
  );
}

async function EveryoneRoom() {
  const me = await requireMember();
  await connection();
  const supabase = await createClient();
  const [{ messages, more }, { data: members }] = await Promise.all([
    loadChat({ room: "everyone" }),
    supabase.from("members").select("id, display_name").returns<{ id: string; display_name: string }[]>(),
  ]);
  return (
    <ChatRoom
      target={{ room: "everyone" }}
      initial={messages}
      more={more}
      names={nameMap(members ?? [])}
      meId={me.id}
      isAdmin={me.role === "admin"}
      nowIso={new Date().toISOString()}
      emptyText="No messages yet. Say hi."
      tall
    />
  );
}
