import { Suspense } from "react";
import Link from "next/link";
import { requireMember } from "@/lib/members";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-black uppercase tracking-wide">Wolfpack</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const me = await requireMember();

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xl">Hey {me.display_name}.</p>
      <p className="text-muted">Events, spots and chat are coming next.</p>
      <nav className="flex flex-wrap gap-3">
        <Link
          href="/members"
          className="inline-flex min-h-11 items-center rounded-md bg-forest px-4 font-semibold text-on-forest"
        >
          {me.role === "admin" ? "Members & invites" : "Members"}
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-11 rounded-md border border-line px-4">
            Sign out
          </button>
        </form>
      </nav>
    </section>
  );
}
