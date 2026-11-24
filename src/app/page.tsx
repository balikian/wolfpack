import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-black uppercase tracking-widest">Wolfpack</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  // The proxy already redirects signed-out visitors; this check is the
  // backstop in case it ever doesn't run.
  if (!data?.claims) redirect("/login");

  return (
    <section className="flex flex-col gap-4">
      <p>Signed in as {data.claims.email}.</p>
      <p className="opacity-70">Events, spots and chat are coming next.</p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="min-h-11 rounded-md border px-4">
          Sign out
        </button>
      </form>
    </section>
  );
}
