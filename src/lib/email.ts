import "server-only";

const FROM = "Wolfpack <no-reply@mail.wolfpackindustries.club>";

type Email = { to: string; subject: string; html: string; text: string };

/** Sends one email through Resend. Returns false (and logs) on any failure. */
export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("sendEmail: RESEND_API_KEY is not set");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, ...email }),
    });
    if (!res.ok) {
      console.error("sendEmail: Resend returned", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEmail: request failed", err);
    return false;
  }
}

/** Escapes text for use inside HTML. */
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
