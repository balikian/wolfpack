import { Suspense } from "react";
import type { Metadata } from "next";
import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Sign in" };

// Where the emailed sign-in link lands. Nothing happens until the button is
// pressed, so link scanners in Outlook, Hotmail and others can't use it up.
export default function ConfirmPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-forest px-4 text-on-forest">
      <h1 className="text-4xl font-black uppercase tracking-widest">Wolfpack</h1>
      <Suspense>
        <ConfirmForm />
      </Suspense>
    </main>
  );
}
