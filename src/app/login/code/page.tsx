import { Suspense } from "react";
import type { Metadata } from "next";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Enter your code" };

export default function CodePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-forest px-4 text-on-forest">
      <h1 className="text-4xl font-black uppercase tracking-widest">Wolfpack</h1>
      <Suspense>
        <CodeForm />
      </Suspense>
    </main>
  );
}
