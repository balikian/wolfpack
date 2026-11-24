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

export const blankEvent: EventFormValues = {
  kind: "hike",
  title: "",
  description: "",
  audience: "everyone",
  starts_at: "",
  ends_at: "",
  location_name: "",
  lat: null,
  lng: null,
  meetup_name: "",
  meetup_at: "",
  meetup_lat: null,
  meetup_lng: null,
};

export function formValuesFrom(e: EventRow): EventFormValues {
  return {
    kind: e.kind,
    title: e.title,
    description: e.description ?? "",
    audience: e.circle_id ?? "everyone",
    starts_at: isoToLocalInput(e.starts_at),
    ends_at: isoToLocalInput(e.ends_at),
    location_name: e.location_name ?? "",
    lat: e.lat,
    lng: e.lng,
    meetup_name: e.meetup_name ?? "",
    meetup_at: isoToLocalInput(e.meetup_at),
    meetup_lat: e.meetup_lat,
    meetup_lng: e.meetup_lng,
  };
}
