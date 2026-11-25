"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useEffectEvent, useRef, useState } from "react";
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

export type Pin = { lat: number; lng: number } | null;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * A map with one pin, which the parent owns (`pin`, `onPinChange`). Tap the
 * map to drop it; drag it to adjust. When the parent moves the pin (say,
 * from a place search) the map flies there. The pin goes into two hidden
 * inputs (`latName`, `lngName`) so it submits with the surrounding form.
 */
export function MapPicker({
  latName,
  lngName,
  pin,
  onPinChange,
  color = "blaze",
  label,
}: {
  latName: string;
  lngName: string;
  pin: Pin;
  onPinChange: (pin: Pin) => void;
  color?: PinColor;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  // Set when the pin moved on the map itself, so the map doesn't re-centre.
  const movedOnMap = useRef(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const fromMap = useEffectEvent((ll: { lat: number; lng: number }) => {
    movedOnMap.current = true;
    onPinChange({ lat: round(ll.lat), lng: round(ll.lng) });
  });

  // Puts the marker where `pin` says, optionally moving the map to it.
  const showPin = useEffectEvent((recenter: boolean) => {
    const L = lib.current;
    const m = map.current;
    if (!L || !m) return;
    if (!pin) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) {
      marker.current.setLatLng(pin);
    } else {
      marker.current = L.marker(pin, { icon: pinIcon(L, color), draggable: true })
        .on("dragend", (e) => fromMap((e.target as Leaflet.Marker).getLatLng()))
        .addTo(m);
    }
    if (recenter) m.setView([pin.lat, pin.lng], Math.max(m.getZoom(), PIN_ZOOM));
  });

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current || map.current) return;
      const m = L.map(box.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => fromMap(e.latlng));
      lib.current = L;
      map.current = m;
      showPin(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const recenter = !movedOnMap.current;
    movedOnMap.current = false;
    showPin(recenter);
  }, [pin]);

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
        onPinChange({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
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
          {pin
            ? "Drag the pin to fine-tune it."
            : "Search above, or tap the map to drop a pin."}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="min-h-9 rounded-md border border-line px-3 font-semibold disabled:opacity-60"
        >
          {locating ? "Finding you…" : "I'm here now"}
        </button>
        {pin && (
          <button
            type="button"
            onClick={() => onPinChange(null)}
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
