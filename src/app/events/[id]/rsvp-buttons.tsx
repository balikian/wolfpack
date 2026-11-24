"use client";

import { useState, useTransition } from "react";
import { setRsvp } from "../actions";

type Status = "going" | "maybe" | "no";

const CHOICES: { status: Status; label: string }[] = [
  { status: "going", label: "Going" },
  { status: "maybe", label: "Maybe" },
  { status: "no", label: "Can't go" },
];

export function RsvpButtons({ eventId, current }: { eventId: string; current: Status | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Your answer" className="flex gap-2">
        {CHOICES.map((c) => {
          const selected = current === c.status;
          return (
            <button
              key={c.status}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await setRsvp(eventId, c.status);
                  if (result.error) setError(result.error);
                })
              }
              className={`min-h-11 flex-1 rounded-md border px-3 font-semibold disabled:opacity-60 ${
                selected ? "border-forest bg-forest text-on-forest" : "border-line bg-card"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
