"use client";

import { startTransition, useActionState, useState } from "react";
import { MapPicker } from "@/components/map-picker";
import type { FormResult } from "./actions";

export type EventFormValues = {
  kind: string;
  title: string;
  description: string;
  audience: string; // "everyone" or a circle id
  starts_at: string; // datetime-local value, site time
  ends_at: string;
  location_name: string;
  lat: number | null;
  lng: number | null;
  meetup_name: string;
  meetup_at: string;
  meetup_lat: number | null;
  meetup_lng: number | null;
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
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  initial: EventFormValues;
  kinds: Option[];
  audiences: Option[];
  timeZoneLabel: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [showMeetup, setShowMeetup] = useState(
    Boolean(initial.meetup_name || initial.meetup_at || initial.meetup_lat !== null),
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
            <select name="kind" defaultValue={initial.kind} className={input}>
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
          <label className={`${labelCls} min-w-52 flex-1`}>
            Starts
            <input
              type="datetime-local"
              name="starts_at"
              required
              defaultValue={initial.starts_at}
              className={input}
            />
          </label>
          <label className={`${labelCls} min-w-52 flex-1`}>
            Ends (optional)
            <input
              type="datetime-local"
              name="ends_at"
              defaultValue={initial.ends_at}
              className={input}
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Where</h2>
        <label className={labelCls}>
          Place name
          <input
            name="location_name"
            maxLength={200}
            defaultValue={initial.location_name}
            placeholder="Trailhead, park, someone's backyard…"
            className={input}
          />
        </label>
        <MapPicker
          latName="lat"
          lngName="lng"
          initial={initial.lat !== null && initial.lng !== null ? { lat: initial.lat, lng: initial.lng } : null}
          label="Map for the event location. Tap to drop a pin."
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Meetup spot</h2>
        {showMeetup ? (
          <>
            <p className="text-sm text-muted">
              Somewhere to gather first, like a park-and-ride for carpooling.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className={`${labelCls} min-w-52 flex-1`}>
                Place name
                <input
                  name="meetup_name"
                  maxLength={200}
                  defaultValue={initial.meetup_name}
                  placeholder="Park-and-ride on Main St"
                  className={input}
                />
              </label>
              <label className={`${labelCls} min-w-52 flex-1`}>
                Meet at
                <input
                  type="datetime-local"
                  name="meetup_at"
                  defaultValue={initial.meetup_at}
                  className={input}
                />
              </label>
            </div>
            <MapPicker
              latName="meetup_lat"
              lngName="meetup_lng"
              color="forest"
              initial={
                initial.meetup_lat !== null && initial.meetup_lng !== null
                  ? { lat: initial.meetup_lat, lng: initial.meetup_lng }
                  : null
              }
              label="Map for the meetup spot. Tap to drop a pin."
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
