import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the secret key. It skips row-level security, so use it
 * only for the few jobs that need it (accepting invites, creating sign-in
 * accounts, blocking sign-in), and only after checking who is asking.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
