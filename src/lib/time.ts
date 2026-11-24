// Dates and times for events. The pack lives in one place, so every time is
// entered and shown in the site's time zone, whatever the server or viewer's
// own clock says (Vercel's servers run on UTC).

export const SITE_TIME_ZONE = "America/Los_Angeles";
export const SITE_TIME_ZONE_LABEL = "Pacific time";

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function zonedParts(date: Date): Parts {
  const get = (type: string) =>
    Number(partsFormatter.formatToParts(date).find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Milliseconds the site time zone is ahead of UTC at this instant. */
function offsetAt(ms: number): number {
  const p = zonedParts(new Date(ms));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(ms / 60000) * 60000;
}

/**
 * Turns a datetime-local value ("2026-12-06T09:30"), read as site time,
 * into an ISO timestamp. Returns null if it isn't a valid date and time.
 */
export function localInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(guess)) return null;

  // Two passes handle the hour around daylight-saving changes.
  let ms = guess - offsetAt(guess);
  const second = offsetAt(ms);
  if (second !== offsetAt(guess)) ms = guess - second;

  // Reject dates that don't exist, like Feb 31.
  const p = zonedParts(new Date(ms));
  if (p.year !== year || p.month !== month || p.day !== day) return null;
  return new Date(ms).toISOString();
}

/** The reverse of localInputToIso, for filling in an edit form. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const p = zonedParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const dayWithYearFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function sameDay(a: Date, b: Date) {
  const x = zonedParts(a);
  const y = zonedParts(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/** "Sat, Dec 6", with the year added when it isn't this year. */
export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  return zonedParts(d).year === zonedParts(now).year
    ? dayFormatter.format(d)
    : dayWithYearFormatter.format(d);
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** "Sat, Dec 6 · 9:00 AM – 2:00 PM", or both days when it spans several. */
export function formatWhen(startIso: string, endIso: string | null, now = new Date()): string {
  const start = `${formatDay(startIso, now)} · ${formatTime(startIso)}`;
  if (!endIso) return start;
  if (sameDay(new Date(startIso), new Date(endIso))) return `${start} – ${formatTime(endIso)}`;
  return `${start} – ${formatDay(endIso, now)} · ${formatTime(endIso)}`;
}
