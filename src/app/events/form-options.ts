import "server-only";
import { EVENT_KINDS, type EventRow } from "@/lib/events";
import { isoToLocalInput } from "@/lib/time";
import type { Circle } from "@/lib/circles";
import type { EventFormValues } from "./event-form";

export const kindOptions = Object.entries(EVENT_KINDS).map(([value, k]) => ({
  value,
  label: `${k.emoji} ${k.label}`,
}));

export function audienceOptions(circles: Circle[]) {
  return [
    { value: "everyone", label: "Everyone in the pack" },
    ...circles.map((c) => ({
      value: c.id,
      label: `${c.emoji ?? "◯"} ${c.name}${c.kind === "secret" ? " (secret)" : ""}`,
    })),
  ];
}

// New events start at 8:00 AM; the date is left for the person to choose.
export const DEFAULT_START_TIME = "08:00";

export const blankEvent: EventFormValues = {
  kind: "hike",
  title: "",
  description: "",
  audience: "everyone",
  starts_date: "",
  starts_time: DEFAULT_START_TIME,
  ends_date: "",
  ends_time: "",
  location_name: "",
  lat: null,
  lng: null,
  meetup_name: "",
  meetup_time: "",
  meetup_lat: null,
  meetup_lng: null,
  trail_url: "",
};

/** Splits a stored time into the form's date and time boxes (site time). */
function split(iso: string | null): { date: string; time: string } {
  const local = isoToLocalInput(iso); // "YYYY-MM-DDTHH:mm" or ""
  const [date = "", time = ""] = local.split("T");
  return { date, time };
}

export function formValuesFrom(e: EventRow): EventFormValues {
  const start = split(e.starts_at);
  const end = split(e.ends_at);
  const meetup = split(e.meetup_at);
  return {
    kind: e.kind,
    title: e.title,
    description: e.description ?? "",
    audience: e.circle_id ?? "everyone",
    starts_date: start.date,
    starts_time: start.time,
    ends_date: end.date && end.date !== start.date ? end.date : "",
    ends_time: end.time,
    location_name: e.location_name ?? "",
    lat: e.lat,
    lng: e.lng,
    meetup_name: e.meetup_name ?? "",
    meetup_time: meetup.time,
    meetup_lat: e.meetup_lat,
    meetup_lng: e.meetup_lng,
    trail_url: e.trail_url ?? "",
  };
}
