import "server-only";

export type CircleKind = "open" | "secret";

export type Circle = {
  id: string;
  name: string;
  emoji: string | null;
  kind: CircleKind;
};

export type CircleMembership = {
  circle_id: string;
  member_id: string;
  is_manager: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Reads and checks the name, emoji and kind fields of the circle form. */
export function parseCircleFields(
  formData: FormData,
): { ok: true; name: string; emoji: string | null; kind: CircleKind } | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 40) {
    return { ok: false, error: "Give the circle a name of up to 40 characters." };
  }

  const emojiRaw = String(formData.get("emoji") ?? "").trim();
  const graphemes = [...new Intl.Segmenter().segment(emojiRaw)].length;
  if (emojiRaw.length > 16 || graphemes > 2) {
    return { ok: false, error: "Use one emoji (or leave it blank)." };
  }

  const kind = formData.get("kind");
  if (kind !== "open" && kind !== "secret") {
    return { ok: false, error: "Choose secret or open." };
  }

  return { ok: true, name, emoji: emojiRaw || null, kind };
}

/** A friendly message for a failed circle write. */
export function circleWriteError(error: { code?: string }): string {
  if (error.code === "23505") return "There's already a circle with that name.";
  if (error.code === "42501") return "You don't have permission to do that.";
  return "Something went wrong. Try again.";
}
