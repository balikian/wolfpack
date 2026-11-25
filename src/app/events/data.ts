import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Circle } from "@/lib/circles";
import type { SavedPlace } from "@/components/place-field";
import {
  EVENT_COLUMNS,
  eventEndMs,
  type EventRow,
  type Rsvp,
  type RsvpStatus,
} from "@/lib/events";

export type EventCard = EventRow & {
  circle: Pick<Circle, "name" | "emoji"> | null;
  goingCount: number;
  myStatus: RsvpStatus | null;
};

// Row-level security returns only events this person may see, so these
// queries need no audience filter of their own.

/** Events that haven't ended yet, soonest first. */
export async function loadUpcoming(meId: string, now: Date, limit?: number) {
  const supabase = await createClient();
  // Look back two weeks so multi-day events that are still going show up.
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("starts_at", since)
    .order("starts_at")
    .returns<EventRow[]>();
  const upcoming = (data ?? []).filter((e) => eventEndMs(e) >= now.getTime());
  return toCards(limit ? upcoming.slice(0, limit) : upcoming, meId);
}

/** The most recent events that have ended, newest first. */
export async function loadPast(meId: string, now: Date, limit: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .lt("starts_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(limit + 10)
    .returns<EventRow[]>();
  const past = (data ?? []).filter((e) => eventEndMs(e) < now.getTime()).slice(0, limit);
  return toCards(past, meId);
}

async function toCards(events: EventRow[], meId: string): Promise<EventCard[]> {
  if (events.length === 0) return [];
  const supabase = await createClient();
  const ids = events.map((e) => e.id);
  const circleIds = [...new Set(events.map((e) => e.circle_id).filter((c): c is string => !!c))];

  const [{ data: rsvps }, { data: circles }] = await Promise.all([
    supabase
      .from("event_rsvps")
      .select("event_id, member_id, status")
      .in("event_id", ids)
      .returns<Rsvp[]>(),
    circleIds.length
      ? supabase.from("circles").select("id, name, emoji").in("id", circleIds).returns<Circle[]>()
      : Promise.resolve({ data: [] as Circle[] }),
  ]);

  const circleById = new Map((circles ?? []).map((c) => [c.id, c]));
  return events.map((e) => {
    const forEvent = (rsvps ?? []).filter((r) => r.event_id === e.id);
    return {
      ...e,
      circle: e.circle_id ? (circleById.get(e.circle_id) ?? null) : null,
      goingCount: forEvent.filter((r) => r.status === "going").length,
      myStatus: forEvent.find((r) => r.member_id === meId)?.status ?? null,
    };
  });
}

export type PlaceHistory = { places: SavedPlace[]; meetups: SavedPlace[] };

/**
 * Places and meetup spots from events this person can see, most recently
 * used first and one per name, for the event form's suggestions. A secret
 * circle's places stay with that circle, since RLS hides its events.
 */
export async function loadPlaceHistory(): Promise<PlaceHistory> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("kind, location_name, lat, lng, trail_url, meetup_name, meetup_lat, meetup_lng")
    .order("starts_at", { ascending: false })
    .limit(300)
    .returns<
      Pick<
        EventRow,
        "kind" | "location_name" | "lat" | "lng" | "trail_url" | "meetup_name" | "meetup_lat" | "meetup_lng"
      >[]
    >();

  const places = new Map<string, SavedPlace>();
  const meetups = new Map<string, SavedPlace>();
  for (const e of data ?? []) {
    const placeKey = e.location_name?.trim().toLowerCase();
    if (placeKey && e.lat !== null && e.lng !== null && !places.has(placeKey)) {
      places.set(placeKey, {
        name: e.location_name!.trim(),
        lat: e.lat,
        lng: e.lng,
        kind: e.kind,
        trail_url: e.trail_url,
      });
    }
    const meetupKey = e.meetup_name?.trim().toLowerCase();
    if (meetupKey && e.meetup_lat !== null && e.meetup_lng !== null && !meetups.has(meetupKey)) {
      meetups.set(meetupKey, { name: e.meetup_name!.trim(), lat: e.meetup_lat, lng: e.meetup_lng });
    }
  }
  return { places: [...places.values()], meetups: [...meetups.values()] };
}

/** Circles this person is in, for the "Who it's for" menu. */
export async function myCircles(meId: string): Promise<Circle[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("member_id", meId)
    .returns<{ circle_id: string }[]>();
  const ids = (rows ?? []).map((r) => r.circle_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("circles")
    .select("id, name, emoji, kind")
    .in("id", ids)
    .order("name")
    .returns<Circle[]>();
  return data ?? [];
}
