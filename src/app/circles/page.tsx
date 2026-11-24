import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import type { Circle, CircleMembership } from "@/lib/circles";
import { CircleForm } from "./circle-form";
import { createCircle } from "./actions";

export const metadata: Metadata = { title: "Circles" };

export default function CirclesPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black uppercase tracking-wide">Circles</h1>
        <Link href="/" className="text-sm font-semibold underline">
          Home
        </Link>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <CirclesContent />
      </Suspense>
    </main>
  );
}

async function CirclesContent() {
  const me = await requireMember();
  const isAdmin = me.role === "admin";
  const supabase = await createClient();

  // Row-level security returns only circles this person may know about:
  // their own, open ones, and (for admins) every circle.
  const [{ data: circles }, { data: memberships }, { data: members }] = await Promise.all([
    supabase.from("circles").select("id, name, emoji, kind").order("name").returns<Circle[]>(),
    supabase
      .from("circle_members")
      .select("circle_id, member_id, is_manager")
      .returns<CircleMembership[]>(),
    supabase.from("members").select("id").eq("status", "active").returns<{ id: string }[]>(),
  ]);

  const active = new Set((members ?? []).map((m) => m.id));
  const rows = (memberships ?? []).filter((m) => active.has(m.member_id));
  const count = (id: string) => rows.filter((r) => r.circle_id === id).length;
  const mine = new Map(rows.filter((r) => r.member_id === me.id).map((r) => [r.circle_id, r]));

  const all = circles ?? [];
  const yours = all.filter((c) => mine.has(c.id));
  const open = all.filter((c) => !mine.has(c.id) && c.kind === "open");
  const otherSecret = all.filter((c) => !mine.has(c.id) && c.kind === "secret");

  return (
    <>
      <p className="text-muted">
        A circle is a group within the pack. Events and spots can be shared with
        Everyone or with just one circle.
      </p>

      <CircleList
        title="Your circles"
        circles={yours}
        count={count}
        note={(c) => (mine.get(c.id)?.is_manager ? "Manager" : null)}
        empty="You're not in any circles yet."
      />

      {open.length > 0 && (
        <CircleList
          title="Open circles"
          circles={open}
          count={count}
          hint="Ask a circle's manager or an admin to add you."
        />
      )}

      {isAdmin && otherSecret.length > 0 && (
        <CircleList
          title="Other secret circles"
          circles={otherSecret}
          count={count}
          hint="You can manage these as an admin, but you can't see what's shared in them unless you join."
        />
      )}

      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            New circle
          </h2>
          <div className="rounded-md border border-line bg-card p-3">
            <CircleForm action={createCircle} />
          </div>
        </section>
      )}
    </>
  );
}

function CircleList({
  title,
  circles,
  count,
  note,
  hint,
  empty,
}: {
  title: string;
  circles: Circle[];
  count: (id: string) => number;
  note?: (c: Circle) => string | null;
  hint?: string;
  empty?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{title}</h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {circles.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
          {circles.map((c) => {
            const n = count(c.id);
            const extra = note?.(c);
            return (
              <li key={c.id}>
                <Link href={`/circles/${c.id}`} className="flex items-center gap-3 p-3">
                  <span className="w-8 text-center text-2xl" aria-hidden>
                    {c.emoji ?? "◯"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{c.name}</span>
                    <span className="text-xs text-muted">
                      {c.kind === "secret" ? "Secret" : "Open"} · {n}{" "}
                      {n === 1 ? "person" : "people"}
                      {extra && ` · ${extra}`}
                    </span>
                  </span>
                  <span className="text-muted" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
