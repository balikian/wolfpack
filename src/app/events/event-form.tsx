"use client";

import { startTransition, useActionState, useState } from "react";
import { PlaceField, type SavedPlace } from "@/components/place-field";
import { wtaSearchUrl } from "@/lib/trails";
import type { FormResult } from "./actions";

export type EventFormValues = {
  kind: string;
  title: string;
  description: string;
  audience: string; // "everyone" or a circle id
  // Dates are YYYY-MM-DD and times HH:mm, in site time.
  starts_date: string;
  starts_time: string;
  ends_date: string; // blank when it ends the same day
  ends_time: string;
  location_name: string;
  lat: number | null;
  lng: number | null;
  meetup_name: string;
  meetup_time: string; // the meetup is on the event's start date
  meetup_lat: number | null;
  meetup_lng: number | null;
  trail_url: string;
};

type Option = { value: string; label: string };

const input = "min-h-11 rounded-md border border-line bg-card px-3 text-base font-normal";
const labelCls = "flex flex-col gap-1 text-sm font-semibold";
const heading = "text-sm font-bold uppercase tracking-wider text-muted";

export function EventForm({
  action,
  initial,
  kinds,
  audiences,
  timeZoneLabel,
  submitLabel,
  history,
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  initial: EventFormValues;
  kinds: Option[];
  audiences: Option[];
  timeZoneLabel: string;
  submitLabel: string;
  history: { places: SavedPlace[]; meetups: SavedPlace[] };
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [kind, setKind] = useState(initial.kind);
  const [placeName, setPlaceName] = useState(initial.location_name);
  const [trailUrl, setTrailUrl] = useState(initial.trail_url);
  const isHike = kind === "hike";
  // For a hike, offer trailheads from earlier hikes; otherwise any place.
  const savedPlaces = isHike ? history.places.filter((p) => p.kind === "hike") : history.places;
  const [showMeetup, setShowMeetup] = useState(
    Boolean(initial.meetup_name || initial.meetup_time || initial.meetup_lat !== null),
  );
  // The meetup search looks near the trailhead first.
  const [placePin, setPlacePin] = useState(
    initial.lat !== null && initial.lng !== null ? { lat: initial.lat, lng: initial.lng } : null,
  );

  return (
    <form
      // Submitting by hand (rather than action={...}) keeps what was typed
      // if the server sends back an error; React resets action forms.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-6"
    >
      <section className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label className={`${labelCls} w-36`}>
            Kind
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={input}
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelCls} min-w-0 flex-1`}>
            Title
            <input
              name="title"
              required
              maxLength={100}
              defaultValue={initial.title}
              placeholder="Saturday hike"
              className={input}
            />
          </label>
        </div>

        <label className={labelCls}>
          Who it&apos;s for
          <select name="audience" defaultValue={initial.audience} className={input}>
            {audiences.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <span className="font-normal text-muted">
            A circle&apos;s events are seen only by people in that circle.
          </span>
        </label>

        <label className={labelCls}>
          Details
          <textarea
            name="description"
            rows={4}
            maxLength={5000}
            defaultValue={initial.description}
            placeholder="What to bring, how hard it is, parking…"
            className={`${input} py-2`}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>When ({timeZoneLabel})</h2>
        <div className="flex flex-wrap gap-2">
          <label className={`${labelCls} min-w-40 flex-[2]`}>
            Date
            <input
              type="date"
              name="starts_date"
              required
              defaultValue={initial.starts_date}
              className={input}
            />
          </label>
          <label className={`${labelCls} min-w-32 flex-1`}>
            Starts at
            <input
              type="time"
              name="starts_time"
              required
              defaultValue={initial.starts_time}
              className={input}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`${labelCls} min-w-32 flex-1`}>
            Ends at (optional)
            <input type="time" name="ends_time" defaultValue={initial.ends_time} className={input} />
          </label>
          <label className={`${labelCls} min-w-40 flex-[2]`}>
            End date, if a later day
            <input type="date" name="ends_date" defaultValue={initial.ends_date} className={input} />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>{isHike ? "Trailhead" : "Where"}</h2>
        <PlaceField
          nameField="location_name"
          latName="lat"
          lngName="lng"
          label={isHike ? "Trailhead name" : "Place name"}
          placeholder={isHike ? "Search, e.g. Mailbox Peak Trailhead" : "Search for a place, or type a name"}
          mapLabel={`Map for the ${isHike ? "trailhead" : "event location"}. Tap to drop a pin.`}
          initialName={initial.location_name}
          initialPin={initial.lat !== null && initial.lng !== null ? { lat: initial.lat, lng: initial.lng } : null}
          saved={savedPlaces}
          savedHeading={isHike ? "Trailheads we've used" : "Places we've used"}
          onNameChange={setPlaceName}
          onPinChange={setPlacePin}
          onPickSaved={(p) => {
            if (isHike && p.trail_url && !trailUrl.trim()) setTrailUrl(p.trail_url);
          }}
        />
        {isHike && (
          <div className="flex flex-col gap-1">
            <label htmlFor="trail_url" className="text-sm font-semibold">
              WTA hike page (optional)
            </label>
            <input
              id="trail_url"
              name="trail_url"
              inputMode="url"
              autoComplete="off"
              maxLength={500}
              value={trailUrl}
              onChange={(e) => setTrailUrl(e.target.value)}
              placeholder="https://www.wta.org/go-hiking/hikes/…"
              className={input}
            />
            <p className="text-sm text-muted">
              <a
                href={wtaSearchUrl(placeName)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                Find it on WTA ↗
              </a>{" "}
              then copy the hike&apos;s address from your browser and paste it here.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Meetup spot</h2>
        {showMeetup ? (
          <>
            <p className="text-sm text-muted">
              Somewhere to gather first, like a park-and-ride for carpooling.
            </p>
            <label className={`${labelCls} max-w-48`}>
              Meet at (same day)
              <input
                type="time"
                name="meetup_time"
                defaultValue={initial.meetup_time}
                className={input}
              />
            </label>
            <PlaceField
              nameField="meetup_name"
              latName="meetup_lat"
              lngName="meetup_lng"
              color="forest"
              label="Meetup place"
              placeholder="Search, e.g. Issaquah Highlands Park & Ride"
              mapLabel="Map for the meetup spot. Tap to drop a pin."
              initialName={initial.meetup_name}
              initialPin={
                initial.meetup_lat !== null && initial.meetup_lng !== null
                  ? { lat: initial.meetup_lat, lng: initial.meetup_lng }
                  : null
              }
              saved={history.meetups}
              near={placePin}
              savedHeading="Meetup spots we've used"
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowMeetup(true)}
            className="min-h-11 self-start rounded-md border border-line px-4 font-semibold"
          >
            Add a meetup spot
          </button>
        )}
      </section>

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-blaze px-6 font-semibold text-on-blaze disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
