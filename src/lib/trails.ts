// Trail links. Safe to import from client components.
//
// WTA (Washington Trails Association) has no public API, but its hike pages
// live at wta.org/go-hiking/hikes/<name>, and its hike search takes the
// name in the URL, so we link to the search and people paste the page.

const TRAIL_WORDS = /\b(trail ?heads?|trails?|th|parking( lot)?|lot)\b/gi;

/** WTA's hike search for a trailhead or hike name. */
export function wtaSearchUrl(name: string): string {
  const term = name.replace(TRAIL_WORDS, " ").replace(/\s+/g, " ").trim();
  return term
    ? `https://www.wta.org/go-outside/hikes?title=${encodeURIComponent(term)}`
    : "https://www.wta.org/go-outside/hikes";
}

export function isWtaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "wta.org" || host.endsWith(".wta.org");
  } catch {
    return false;
  }
}

/**
 * Tidies a pasted trail link: adds https:// if it was left off. Returns null
 * for an empty value and false for anything that isn't a web link.
 */
export function normalizeTrailUrl(raw: string): string | null | false {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  if (withScheme.length > 500 || /\s/.test(withScheme)) return false;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (!url.hostname.includes(".")) return false;
    return withScheme;
  } catch {
    return false;
  }
}
