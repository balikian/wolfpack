import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { isUuid, type Circle } from "@/lib/circles";
import {
  EVENT_COLUMNS,
  EVENT_KINDS,
  directionsUrl,
  eventEndMs,
  type EventRow,
  type Rsvp,
} from "@/lib/events";
import { isWtaUrl } from "@/lib/trails";
import { formatDay, formatTime, formatWhen, SITE_TIME_ZONE_LABEL } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { MapView, type MapPoint } from "@/components/map-view";
import { RsvpButtons } from "./rsvp-buttons";
import { ChatRoom } from "@/components/chat/chat-room";
import { loadChat, nameMap } from "@/lib/chat";
import { deleteEvent } from "../actions";

export const metadata: Metadata = { title: "Event" };

type MemberName = { id: string; display_name: string; status: string };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <nav>
        <Link href="/events" className="text-sm font-semibold underline">
          ‹ All events
        </Link>
      </nav>
      <Suspense fallback={<p>Loading…</p>}>
        <EventContent params={params} />
      </Suspense>
    </main>
  );
}

async function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await connection();
  const now = new Date();

  const supabase = await createClient();
  // An event this person can't see comes back empty, the same as one that
  // doesn't exist.
  const { data: event } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const [{ data: rsvps }, { data: members }, { data: circle }, chat] = await Promise.all([
    supabase
      .from("event_rsvps")
      .select("event_id, member_id, status")
      .eq("event_id", id)
      .returns<Rsvp[]>(),
    supabase.from("members").select("id, display_name, status").returns<MemberName[]>(),
    event.circle_id
      ? supabase
          .from("circles")
          .select("id, name, emoji, kind")
          .eq("id", event.circle_id)
          .maybeSingle<Circle>()
      : Promise.resolve({ data: null }),
    loadChat({ room: "event", eventId: id }),
  ]);

  const nameOf = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const activeIds = new Set(
    (members ?? []).filter((m) => m.status === "active").map((m) => m.id),
  );
  const answers = (rsvps ?? []).filter((r) => activeIds.has(r.member_id));
  const people = (status: Rsvp["status"]) =>
    answers
      .filter((r) => r.status === status)
      .map((r) => nameOf.get(r.member_id) ?? "Someone")
      .sort((a, b) => a.localeCompare(b));
  const going = people("going");
  const maybe = people("maybe");
  const cant = people("no");
  const mine = answers.find((r) => r.member_id === me.id)?.status ?? null;

  const canEdit = event.created_by === me.id || me.role === "admin";
  const isOver = eventEndMs(event) < now.getTime();
  const kind = EVENT_KINDS[event.kind];
  const postedBy = event.created_by ? nameOf.get(event.created_by) : undefined;

  const points: MapPoint[] = [];
  if (event.lat !== null && event.lng !== null) {
    points.push({
      lat: event.lat,
      lng: event.lng,
      label: event.location_name ?? "Event",
      color: "blaze",
    });
  }
  if (event.meetup_lat !== null && event.meetup_lng !== null) {
    points.push({
      lat: event.meetup_lat,
      lng: event.meetup_lng,
      label: event.meetup_name ?? "Meetup",
      color: "forest",
    });
  }
  const hasMeetup = Boolean(event.meetup_name || event.meetup_at || event.meetup_lat !== null);
  const hasPlace = Boolean(event.location_name || event.lat !== null);
  const isHike = event.kind === "hike";

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-muted">
          {kind.emoji} {kind.label} ·{" "}
          {circle ? `${circle.emoji ?? "◯"} ${circle.name}` : "Everyone"}
        </p>
        <h1 className="text-3xl font-black tracking-wide">{event.title}</h1>
        <p className="text-lg">{formatWhen(event.starts_at, event.ends_at, now)}</p>
        <p className="text-xs text-muted">
          Times are {SITE_TIME_ZONE_LABEL}.{postedBy && ` Posted by ${postedBy}.`}
        </p>
      </header>

      {!isOver && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Are you in?</h2>
          <RsvpButtons eventId={event.id} current={mine} />
        </section>
      )}

      {event.description && (
        <section className="whitespace-pre-wrap rounded-md border border-line bg-card p-3">
          {event.description}
        </section>
      )}

      {(hasPlace || hasMeetup || event.trail_url) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Where</h2>
          {(hasPlace || event.trail_url) && (
            <Place
              dot="blaze"
              caption={isHike ? "Trailhead" : null}
              name={event.location_name ?? (isHike ? "Trailhead" : "Event location")}
              lat={event.lat}
              lng={event.lng}
              link={
                event.trail_url
                  ? {
                      href: event.trail_url,
                      label: isWtaUrl(event.trail_url) ? "WTA hike page" : "Trail info",
                    }
                  : null
              }
            />
          )}
          {hasMeetup && (
            <Place
              dot="forest"
              caption="Meetup"
              name={event.meetup_name ?? "Meetup spot"}
              lat={event.meetup_lat}
              lng={event.meetup_lng}
              when={
                event.meetup_at
                  ? `${formatDay(event.meetup_at, now)} · ${formatTime(event.meetup_at)}`
                  : null
              }
            />
          )}
          {points.length > 0 && <MapView points={points} label={`Map of ${event.title}`} />}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          {isOver ? "Who said they would go" : "Who is coming"}
        </h2>
        <PeopleLine label="Going" names={going} />
        {maybe.length > 0 && <PeopleLine label="Maybe" names={maybe} />}
        {cant.length > 0 && <PeopleLine label="Can't go" names={cant} />}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Chat</h2>
        <ChatRoom
          target={{ room: "event", eventId: event.id }}
          initial={chat.messages}
          more={chat.more}
          names={nameMap(members ?? [])}
          meId={me.id}
          isAdmin={me.role === "admin"}
          nowIso={now.toISOString()}
          emptyText={isHike ? "No messages yet. Ask about carpools or gear." : "No messages yet."}
        />
        <p className="text-xs text-muted">
          {circle
            ? `Only people in ${circle.name} can see this chat.`
            : "Everyone in the pack can see this chat."}
        </p>
      </section>

      {canEdit && (
        <section className="flex flex-wrap items-start gap-2">
          <Link
            href={`/events/${event.id}/edit`}
            className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-sm font-semibold"
          >
            Edit
          </Link>
          <ActionButton
            action={deleteEvent.bind(null, event.id)}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            confirmText={`Delete "${event.title}"? Everyone's answers go with it. This can't be undone.`}
          />
        </section>
      )}
    </>
  );
}

function Place({
  dot,
  name,
  lat,
  lng,
  when,
  caption,
  link,
}: {
  dot: "blaze" | "forest";
  name: string;
  lat: number | null;
  lng: number | null;
  when?: string | null;
  caption?: string | null;
  link?: { href: string; label: string } | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-1.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full ${dot === "blaze" ? "bg-blaze" : "bg-forest"}`}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {caption && (
          <span className="text-xs font-bold uppercase tracking-wider text-muted">{caption}</span>
        )}
        <span className="font-semibold">{name}</span>
        {when && <span className="text-sm">{when}</span>}
        <span className="flex flex-wrap gap-x-4">
          {lat !== null && lng !== null && (
            <a
              href={directionsUrl(lat, lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold underline"
            >
              Directions
            </a>
          )}
          {link && (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold underline"
            >
              {link.label} ↗
            </a>
          )}
        </span>
      </div>
    </div>
  );
}

function PeopleLine({ label, names }: { label: string; names: string[] }) {
  return (
    <p>
      <span className="font-semibold">
        {label} ({names.length}):
      </span>{" "}
      {names.length ? names.join(", ") : <span className="text-muted">nobody yet</span>}
    </p>
  );
}
