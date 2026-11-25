// Place search for the map pickers, using Photon (photon.komoot.io): a free
// search-as-you-type service over OpenStreetMap data. Its public server asks
// for fair use, so searches wait for a pause in typing and need 3+ letters.

export type FoundPlace = {
  key: string;
  name: string;
  /** e.g. "Trailhead · King County, Washington" */
  detail: string;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
};

// Results lean toward the Puget Sound area but still find places elsewhere.
const BIAS = { lat: 47.6, lng: -122.0 };

const TYPE_LABELS: Record<string, string> = {
  trailhead: "Trailhead",
  parking: "Parking",
  viewpoint: "Viewpoint",
  peak: "Peak",
  path: "Trail",
  footway: "Trail",
  track: "Trail",
  steps: "Trail",
  water: "Lake",
  lake: "Lake",
  park: "Park",
  nature_reserve: "Nature reserve",
  camp_site: "Campground",
  bus_station: "Transit",
  restaurant: "Restaurant",
  bar: "Bar",
  pub: "Pub",
  cafe: "Café",
  house: "Address",
  residential: "Street",
};

function typeLabel(p: PhotonFeature["properties"]): string | null {
  const v = p.osm_value ?? "";
  if (TYPE_LABELS[v]) return TYPE_LABELS[v];
  if (p.osm_key === "place") return "Town";
  if (p.osm_key === "highway") return "Road";
  return v ? v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : null;
}

function nameOf(p: PhotonFeature["properties"]): string | null {
  if (p.name) return p.name;
  if (p.street) return [p.housenumber, p.street].filter(Boolean).join(" ");
  return null;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<FoundPlace[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "8",
    lang: "en",
    lat: String(BIAS.lat),
    lon: String(BIAS.lng),
  });
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const body = (await res.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  const out: FoundPlace[] = [];
  for (const f of body.features ?? []) {
    const p = f.properties;
    const name = nameOf(p);
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // The same spot often comes back twice (a trailhead and its parking lot).
    const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const where = [
      p.city,
      p.county && !p.city ? `${p.county} County` : null,
      p.state,
      p.countrycode && p.countrycode !== "US" ? p.countrycode : null,
    ].filter(Boolean);
    out.push({
      key,
      name,
      detail: [typeLabel(p), where.join(", ")].filter(Boolean).join(" · "),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    });
  }
  return out;
}
