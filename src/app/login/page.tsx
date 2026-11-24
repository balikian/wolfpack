import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { devSwitcherEnabled } from "@/lib/dev";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-forest px-4 text-on-forest">
      <h1 className="text-4xl font-black uppercase tracking-widest">Wolfpack</h1>
      <p>Members only.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="max-w-xs text-center text-sm opacity-80">
        No account? Ask a member for an invite.
      </p>
      {devSwitcherEnabled && (
        <Link href="/dev/switch" className="text-sm font-semibold underline">
          Switch account (local testing)
        </Link>
      )}
    </main>
  );
}
