import "server-only";
import { isUuid } from "@/lib/circles";
import { localInputToIso } from "@/lib/time";
import { normalizeTrailUrl } from "@/lib/trails";

export const EVENT_KINDS = {
  hike: { label: "Hike", emoji: "🥾" },
  party: { label: "Party", emoji: "🎉" },
  hangout: { label: "Get-together", emoji: "🍻" },
  other: { label: "Other", emoji: "📅" },
} as const;

export type EventKind = keyof typeof EVENT_KINDS;
export type RsvpStatus = "going" | "maybe" | "no";

export type EventRow = {
  id: string;
  circle_id: string | null;
  created_by: string | null;
  kind: EventKind;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  meetup_name: string | null;
  meetup_lat: number | null;
  meetup_lng: number | null;
  meetup_at: string | null;
  trail_url: string | null;
};

export const EVENT_COLUMNS =
  "id, circle_id, created_by, kind, title, description, starts_at, ends_at, location_name, lat, lng, meetup_name, meetup_lat, meetup_lng, meetup_at, trail_url";

export type Rsvp = { event_id: string; member_id: string; status: RsvpStatus };

/** When an event counts as over: its end, or 4 hours after it starts. */
export function eventEndMs(e: Pick<EventRow, "starts_at" | "ends_at">): number {
  return e.ends_at
    ? new Date(e.ends_at).getTime()
    : new Date(e.starts_at).getTime() + 4 * 60 * 60 * 1000;
}

export type EventFields = Omit<EventRow, "id" | "created_by">;

function text(formData: FormData, name: string, max: number): string | null | false {
  const v = String(formData.get(name) ?? "").trim();
  if (v.length > max) return false;
  return v || null;
}

function pin(
  formData: FormData,
  latName: string,
  lngName: string,
): { lat: number | null; lng: number | null } | null {
  const latRaw = String(formData.get(latName) ?? "").trim();
  const lngRaw = String(formData.get(lngName) ?? "").trim();
  if (!latRaw && !lngRaw) return { lat: null, lng: null };
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!latRaw || !lngRaw || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Reads and checks the event form. */
export function parseEventForm(
  formData: FormData,
): { ok: true; fields: EventFields } | { ok: false; error: string } {
  const kind = String(formData.get("kind") ?? "");
  if (!(kind in EVENT_KINDS)) return { ok: false, error: "Choose what kind of event it is." };

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 1 || title.length > 100) {
    return { ok: false, error: "Give it a title of up to 100 characters." };
  }

  const description = text(formData, "description", 5000);
  if (description === false) return { ok: false, error: "Keep the details under 5,000 characters." };

  const audience = String(formData.get("audience") ?? "");
  if (audience !== "everyone" && !isUuid(audience)) {
    return { ok: false, error: "Choose who it's for." };
  }

  // The form has separate date and time boxes, in site time.
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  // Time boxes send HH:mm (some browsers add :ss, which is dropped).
  const at = (date: string, time: string) => localInputToIso(`${date}T${time.slice(0, 5)}`);

  const startDate = field("starts_date");
  const startTime = field("starts_time");
  if (!startDate) return { ok: false, error: "Choose the date." };
  if (!startTime) return { ok: false, error: "Enter when it starts." };
  const starts_at = at(startDate, startTime);
  if (!starts_at) return { ok: false, error: "The start date or time isn't valid." };

  // An end is optional. Without its own date it ends the same day.
  const endDate = field("ends_date");
  const endTime = field("ends_time");
  if (endDate && !endTime) return { ok: false, error: "Add an end time, or clear the end date." };
  const ends_at = endTime ? at(endDate || startDate, endTime) : null;
  if (endTime && !ends_at) return { ok: false, error: "The end date or time isn't valid." };
  if (ends_at && ends_at <= starts_at) {
    return {
      ok: false,
      error: endDate
        ? "It has to end after it starts."
        : "It has to end after it starts. For an overnight trip, add the end date.",
    };
  }

  const location_name = text(formData, "location_name", 200);
  const meetup_name = text(formData, "meetup_name", 200);
  if (location_name === false || meetup_name === false) {
    return { ok: false, error: "Keep place names under 200 characters." };
  }

  const where = pin(formData, "lat", "lng");
  const meetup = pin(formData, "meetup_lat", "meetup_lng");
  if (!where || !meetup) return { ok: false, error: "A map pin isn't valid. Clear it and drop it again." };

  // The meetup is on the start date.
  const meetupTime = field("meetup_time");
  const meetup_at = meetupTime ? at(startDate, meetupTime) : null;
  if (meetupTime && !meetup_at) return { ok: false, error: "The meetup time isn't valid." };

  // Only hikes have a trail link; the field isn't shown for other kinds.
  const trail_url = kind === "hike" ? normalizeTrailUrl(String(formData.get("trail_url") ?? "")) : null;
  if (trail_url === false) {
    return { ok: false, error: "The trail link should be a web address, like https://www.wta.org/go-hiking/hikes/…" };
  }

  return {
    ok: true,
    fields: {
      circle_id: audience === "everyone" ? null : audience,
      kind: kind as EventKind,
      title,
      description,
      starts_at,
      ends_at,
      location_name,
      lat: where.lat,
      lng: where.lng,
      meetup_name,
      meetup_lat: meetup.lat,
      meetup_lng: meetup.lng,
      meetup_at,
      trail_url,
    },
  };
}

/** Google Maps directions to a point; opens the maps app on phones. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
