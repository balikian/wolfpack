"use client";

import { useId, useRef, useState } from "react";
import { MapPicker, type Pin } from "./map-picker";
import { searchPlaces, type FoundPlace } from "./place-search";
import type { PinColor } from "./map-common";

/** A place used on an earlier event, offered again as a shortcut. */
export type SavedPlace = {
  name: string;
  lat: number;
  lng: number;
  trail_url?: string | null;
  kind?: string;
};

type Suggestion =
  | { source: "saved"; key: string; place: SavedPlace }
  | { source: "search"; key: string; place: FoundPlace };

const input = "min-h-11 w-full rounded-md border border-line bg-card px-3 text-base font-normal";

/**
 * A place name with a map. Typing in the name searches for places: places
 * the pack has used before come first, then search results. Picking one
 * fills in the name and drops the pin. Any name can still be typed by hand,
 * with the pin dropped on the map.
 */
export function PlaceField({
  nameField,
  latName,
  lngName,
  label,
  placeholder,
  mapLabel,
  initialName,
  initialPin,
  saved,
  savedHeading,
  color = "blaze",
  onNameChange,
  onPickSaved,
}: {
  nameField: string;
  latName: string;
  lngName: string;
  label: string;
  placeholder: string;
  mapLabel: string;
  initialName: string;
  initialPin: Pin;
  saved: SavedPlace[];
  savedHeading: string;
  color?: PinColor;
  onNameChange?: (name: string) => void;
  onPickSaved?: (place: SavedPlace) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [name, setName] = useState(initialName);
  const [pin, setPin] = useState<Pin>(initialPin);
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<FoundPlace[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const query = name.trim().toLowerCase();
  const savedMatches = (
    query ? saved.filter((p) => p.name.toLowerCase().includes(query)) : saved
  ).slice(0, query ? 4 : 8);
  const searchable = query.length >= 3;
  const suggestions: Suggestion[] = [
    ...savedMatches.map((p) => ({ source: "saved" as const, key: `saved:${p.name}`, place: p })),
    ...(searchable ? found : [])
      // Skip search results that repeat a saved place.
      .filter((f) => !savedMatches.some((s) => s.name.toLowerCase() === f.name.toLowerCase()))
      .map((f) => ({ source: "search" as const, key: f.key, place: f })),
  ];
  const showList = open && (suggestions.length > 0 || (searchable && status !== "idle"));

  function changeName(next: string) {
    setName(next);
    onNameChange?.(next);
    setOpen(true);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    inflight.current?.abort();
    if (next.trim().length < 3) {
      setFound([]);
      setStatus("idle");
      return;
    }
    setStatus("searching");
    // Wait for a pause in typing; the search service asks for fair use.
    timer.current = setTimeout(() => {
      const controller = new AbortController();
      inflight.current = controller;
      searchPlaces(next.trim(), controller.signal)
        .then((results) => {
          setFound(results);
          setStatus("done");
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setFound([]);
          setStatus("error");
        });
    }, 400);
  }

  function pick(s: Suggestion) {
    setName(s.place.name);
    onNameChange?.(s.place.name);
    setPin({ lat: s.place.lat, lng: s.place.lng });
    setOpen(false);
    setActive(-1);
    if (s.source === "saved") onPickSaved?.(s.place);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!suggestions.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && showList && active >= 0 && suggestions[active]) {
      // Choose the highlighted place instead of submitting the form.
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const firstSearch = suggestions.findIndex((s) => s.source === "search");

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex flex-col gap-1 text-sm font-semibold">
        <label htmlFor={`${id}-name`}>{label}</label>
        <input
          id={`${id}-name`}
          name={nameField}
          value={name}
          onChange={(e) => changeName(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          maxLength={200}
          autoComplete="off"
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          className={input}
        />
        {showList && (
          <div className="absolute inset-x-0 top-full z-[1100] mt-1 max-h-80 overflow-y-auto rounded-md border border-line bg-card font-normal shadow-lg">
            <ul id={listId} role="listbox" aria-label={`Suggestions for ${label}`}>
              {suggestions.map((s, i) => (
                <li key={s.key} role="presentation">
                  {i === 0 && s.source === "saved" && <ListHeading divider={false}>{savedHeading}</ListHeading>}
                  {i === firstSearch && <ListHeading divider={i > 0}>Search results</ListHeading>}
                  <button
                    type="button"
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    tabIndex={-1}
                    // Keep focus in the input so the list doesn't close first.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left ${i === active ? "bg-line" : "hover:bg-line"}`}
                  >
                    <span className="font-semibold">{s.place.name}</span>
                    {s.source === "search" && s.place.detail && (
                      <span className="text-xs text-muted">{s.place.detail}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {searchable && (
              <p className="px-3 py-2 text-xs text-muted">
                {status === "searching"
                  ? "Searching…"
                  : status === "error"
                    ? "Search isn't working right now. Type a name and tap the map instead."
                    : firstSearch === -1
                      ? "No places found. Keep the name and tap the map to drop a pin."
                      : "Search: OpenStreetMap via Photon"}
              </p>
            )}
          </div>
        )}
      </div>
      <MapPicker
        latName={latName}
        lngName={lngName}
        pin={pin}
        onPinChange={setPin}
        color={color}
        label={mapLabel}
      />
    </div>
  );
}

function ListHeading({ children, divider }: { children: React.ReactNode; divider: boolean }) {
  return (
    <p className={`px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wider text-muted ${divider ? "border-t border-line" : ""}`}>
      {children}
    </p>
  );
}
