"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import {
  PIN_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
  loadLeaflet,
  pinIcon,
  type PinColor,
} from "./map-common";

export type MapPoint = { lat: number; lng: number; label: string; color: PinColor };

/** A read-only map showing one or more pins. */
export function MapView({ points, label }: { points: MapPoint[]; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(points);

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;
    const pts: MapPoint[] = JSON.parse(key);

    loadLeaflet().then((L) => {
      if (cancelled || !box.current || pts.length === 0) return;
      const m = L.map(box.current, { scrollWheelZoom: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
      for (const p of pts) {
        L.marker([p.lat, p.lng], { icon: pinIcon(L, p.color), title: p.label, alt: p.label })
          .bindTooltip(p.label)
          .addTo(m);
      }
      if (pts.length === 1) {
        m.setView([pts[0].lat, pts[0].lng], PIN_ZOOM);
      } else {
        m.fitBounds(
          pts.map((p) => [p.lat, p.lng] as [number, number]),
          { padding: [40, 40], maxZoom: PIN_ZOOM },
        );
      }
      remove = () => m.remove();
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [key]);

  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      className="isolate h-64 w-full overflow-hidden rounded-md border border-line"
    />
  );
}
