"use client";

import { useEffect, useRef, useState } from "react";

// A short list that fits what the pack does. Any other emoji can be typed or
// pasted into the box at the bottom of the picker.
const CHOICES = [
  "🍄", "🎣", "🥾", "⛺", "🏕️", "🔥", "🌲", "🏔️", "🌊", "🏞️",
  "🛶", "🚴", "🧗", "🏂", "⛷️", "🦌", "🐺", "🐻", "🦅", "🐟",
  "🦀", "🌿", "🍂", "🌸", "🫐", "🍓", "🍷", "🍺", "🥃", "🍕",
  "🌮", "🍖", "🧀", "🎉", "🎶", "🎸", "🎲", "🃏", "⚽", "⛳",
  "🏖️", "☀️", "🌙", "⭐", "📷", "🚗", "🏠", "❤️", "💀", "🦄",
];

/**
 * A button that opens a grid of emoji. The choice is submitted with the
 * surrounding form as a hidden input called `name`.
 */
export function EmojiPicker({ name, initial }: { name: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (emoji: string) => {
    setValue(emoji);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Emoji: ${value}. Change it` : "Choose an emoji"}
        className="flex min-h-11 w-full items-center justify-center rounded-md border border-line bg-card px-3 text-2xl"
      >
        {value || <span className="text-sm font-normal text-muted">Pick</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose an emoji"
          className="absolute left-0 top-full z-20 mt-1 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-md border border-line bg-card p-2 shadow-lg"
        >
          <div className="grid grid-cols-8 gap-1">
            {CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => choose(e)}
                aria-pressed={value === e}
                className={`flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-paper ${
                  value === e ? "bg-paper ring-2 ring-blaze" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Or type or paste any emoji (Windows: Win + . · Mac: Ctrl + Cmd + Space)
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={16}
              autoComplete="off"
              className="min-h-9 rounded-md border border-line bg-paper px-2 text-center text-lg text-ink"
            />
          </label>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => choose("")}
              className="min-h-9 rounded-md border border-line px-3 text-sm font-semibold"
            >
              No emoji
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-9 rounded-md bg-forest px-3 text-sm font-semibold text-on-forest"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
