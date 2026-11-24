import type * as Leaflet from "leaflet";

// Free OpenStreetMap tiles. Their usage policy asks for this credit on the map.
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Where an empty map starts: the US West Coast.
export const DEFAULT_CENTER: [number, number] = [41, -120];
export const DEFAULT_ZOOM = 5;
export const PIN_ZOOM = 13;

export type PinColor = "blaze" | "forest";

/** Leaflet touches window when imported, so load it only in the browser. */
export async function loadLeaflet(): Promise<typeof Leaflet> {
  const mod = await import("leaflet");
  return (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
}

/** A round pin drawn with CSS, so no marker image files are needed. */
export function pinIcon(L: typeof Leaflet, color: PinColor) {
  return L.divIcon({
    className: "",
    html: `<span class="wp-pin wp-pin-${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
