import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/circles";
import { EVENT_COLUMNS, type EventRow } from "@/lib/events";
import { SITE_TIME_ZONE_LABEL } from "@/lib/time";
import { EventForm } from "../../event-form";
import { updateEvent } from "../../actions";
import { loadPlaceHistory, myCircles } from "../../data";
import { audienceOptions, formValuesFrom, kindOptions } from "../../form-options";

export const metadata: Metadata = { title: "Edit event" };

export default function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-black uppercase tracking-wide">Edit event</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <EditContent params={params} />
      </Suspense>
    </main>
  );
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle<EventRow>();
  if (!event) notFound();
  if (event.created_by !== me.id && me.role !== "admin") notFound();

  const [circles, history] = await Promise.all([myCircles(me.id), loadPlaceHistory()]);
  // Anyone who can see a circle's event is in that circle, so the event's
  // own circle is always in this menu.
  return (
    <>
      <nav>
        <Link href={`/events/${id}`} className="text-sm font-semibold underline">
          ‹ Back to the event
        </Link>
      </nav>
      <EventForm
        action={updateEvent.bind(null, id)}
        initial={formValuesFrom(event)}
        kinds={kindOptions}
        audiences={audienceOptions(circles)}
        timeZoneLabel={SITE_TIME_ZONE_LABEL}
        submitLabel="Save changes"
        history={history}
      />
    </>
  );
}
