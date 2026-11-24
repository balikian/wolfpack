import Link from "next/link";
import { EVENT_KINDS } from "@/lib/events";
import { formatWhen } from "@/lib/time";
import type { EventCard } from "./data";

const STATUS_LABEL = { going: "You're going", maybe: "You're a maybe", no: "You can't go" } as const;

export function EventList({ events, now }: { events: EventCard[]; now: Date }) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={`/events/${e.id}`} className="flex items-center gap-3 p-3">
            <span className="w-8 text-center text-2xl" aria-hidden>
              {EVENT_KINDS[e.kind].emoji}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{e.title}</span>
              <span className="text-sm">{formatWhen(e.starts_at, e.ends_at, now)}</span>
              <span className="text-xs text-muted">
                {e.circle ? `${e.circle.emoji ?? "◯"} ${e.circle.name}` : "Everyone"}
                {` · ${e.goingCount} going`}
                {e.myStatus && ` · ${STATUS_LABEL[e.myStatus]}`}
              </span>
            </span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
