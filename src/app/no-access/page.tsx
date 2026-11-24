import type { Metadata } from "next";

export const metadata: Metadata = { title: "No access" };

// Signed in, but not an active member (deactivated, or never invited).
export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-forest px-4 text-center text-on-forest">
      <h1 className="text-4xl font-black uppercase tracking-widest">Wolfpack</h1>
      <p className="max-w-xs">
        This account doesn&apos;t have access. If you think that&apos;s a
        mistake, ask an admin for an invite.
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="min-h-11 rounded-md border border-on-forest/50 px-4">
          Sign out
        </button>
      </form>
    </main>
  );
}
