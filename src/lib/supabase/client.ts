"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for the browser, signed in with the same session cookie
 * as the server. Used for live chat updates; row-level security decides what
 * it can read, exactly as on the server.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
