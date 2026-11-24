import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { EventList } from "./event-list";
import { loadPast, loadUpcoming } from "./data";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black uppercase tracking-wide">Events</h1>
        <Link href="/" className="text-sm font-semibold underline">
          Home
        </Link>
      </header>
      <Link
        href="/events/new"
        className="inline-flex min-h-11 items-center self-start rounded-md bg-blaze px-4 font-semibold text-on-blaze"
      >
        New event
      </Link>
      <Suspense fallback={<p>Loading…</p>}>
        <EventsContent />
      </Suspense>
    </main>
  );
}

async function EventsContent() {
  const me = await requireMember();
  await connection();
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    loadUpcoming(me.id, now),
    loadPast(me.id, now, 10),
  ]);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted">Nothing planned yet. Start something!</p>
        ) : (
          <EventList events={upcoming} now={now} />
        )}
      </section>
      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Recent</h2>
          <EventList events={past} now={now} />
        </section>
      )}
    </>
  );
}
