"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  PIN_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
  loadLeaflet,
  pinIcon,
  type PinColor,
} from "./map-common";

type Pin = { lat: number; lng: number } | null;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Tap the map to drop a pin; drag it to adjust. The pin goes into two hidden
 * inputs (`latName`, `lngName`) so it submits with the surrounding form.
 */
export function MapPicker({
  latName,
  lngName,
  initial,
  color = "blaze",
  label,
}: {
  latName: string;
  lngName: string;
  initial: Pin;
  color?: PinColor;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const placeRef = useRef<(p: Pin) => void>(() => {});
  const [pin, setPin] = useState<Pin>(initial);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current || map.current) return;
      const m = L.map(box.current, { scrollWheelZoom: false }).setView(
        initial ? [initial.lat, initial.lng] : DEFAULT_CENTER,
        initial ? PIN_ZOOM : DEFAULT_ZOOM,
      );
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
      map.current = m;

      const place = (p: Pin) => {
        if (!p) {
          marker.current?.remove();
          marker.current = null;
          setPin(null);
          return;
        }
        const next = { lat: round(p.lat), lng: round(p.lng) };
        if (marker.current) {
          marker.current.setLatLng(next);
        } else {
          marker.current = L.marker(next, { icon: pinIcon(L, color), draggable: true })
            .on("dragend", (e) => {
              const ll = (e.target as Leaflet.Marker).getLatLng();
              setPin({ lat: round(ll.lat), lng: round(ll.lng) });
            })
            .addTo(m);
        }
        setPin(next);
      };
      placeRef.current = place;
      if (initial) place(initial);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => place(e.latlng));
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; later pins go through place().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locateMe() {
    if (!navigator.geolocation) {
      setNote("This browser can't share its location.");
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        placeRef.current(p);
        map.current?.setView([p.lat, p.lng], PIN_ZOOM);
      },
      () => {
        setLocating(false);
        setNote("Couldn't get your location. Tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={box}
        role="application"
        aria-label={label}
        className="isolate h-64 w-full overflow-hidden rounded-md border border-line"
      />
      <input type="hidden" name={latName} value={pin?.lat ?? ""} />
      <input type="hidden" name={lngName} value={pin?.lng ?? ""} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          {pin ? `Pin at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Tap the map to drop a pin."}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="min-h-9 rounded-md border border-line px-3 font-semibold disabled:opacity-60"
        >
          {locating ? "Finding you…" : "Use my location"}
        </button>
        {pin && (
          <button
            type="button"
            onClick={() => placeRef.current(null)}
            className="min-h-9 rounded-md border border-line px-3 font-semibold"
          >
            Clear pin
          </button>
        )}
      </div>
      {note && <p className="text-sm text-danger">{note}</p>}
    </div>
  );
}
