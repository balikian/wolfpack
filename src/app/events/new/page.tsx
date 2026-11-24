import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { SITE_TIME_ZONE_LABEL } from "@/lib/time";
import { EventForm } from "../event-form";
import { createEvent } from "../actions";
import { myCircles } from "../data";
import { audienceOptions, blankEvent, kindOptions } from "../form-options";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <nav>
        <Link href="/events" className="text-sm font-semibold underline">
          ‹ All events
        </Link>
      </nav>
      <h1 className="text-3xl font-black uppercase tracking-wide">New event</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewEventForm />
      </Suspense>
    </main>
  );
}

async function NewEventForm() {
  const me = await requireMember();
  const circles = await myCircles(me.id);
  return (
    <EventForm
      action={createEvent}
      initial={blankEvent}
      kinds={kindOptions}
      audiences={audienceOptions(circles)}
      timeZoneLabel={SITE_TIME_ZONE_LABEL}
      submitLabel="Create event"
    />
  );
}
