import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireMember } from "@/lib/members";
import { devSwitcherEnabled } from "@/lib/dev";
import { EventList } from "./events/event-list";
import { loadUpcoming } from "./events/data";

const navButton =
  "inline-flex min-h-11 items-center rounded-md bg-forest px-4 font-semibold text-on-forest";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-black uppercase tracking-wide">Wolfpack</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const me = await requireMember();
  await connection();
  const now = new Date();
  const upcoming = await loadUpcoming(me.id, now, 3);

  return (
    <>
      <p className="text-xl">Hey {me.display_name}.</p>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Coming up</h2>
          <Link href="/events/new" className="text-sm font-semibold underline">
            New event
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-muted">Nothing planned yet.</p>
        ) : (
          <EventList events={upcoming} now={now} />
        )}
      </section>

      <nav className="flex flex-wrap gap-3">
        <Link href="/events" className={navButton}>
          Events
        </Link>
        <Link href="/chat" className={navButton}>
          Chat
        </Link>
        <Link href="/circles" className={navButton}>
          Circles
        </Link>
        <Link href="/members" className={navButton}>
          {me.role === "admin" ? "Members & invites" : "Members"}
        </Link>
        {devSwitcherEnabled && (
          <Link href="/dev/switch" className="inline-flex min-h-11 items-center rounded-md border border-blaze px-4 font-semibold">
            Switch account (dev)
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-11 rounded-md border border-line px-4">
            Sign out
          </button>
        </form>
      </nav>
    </>
  );
}
