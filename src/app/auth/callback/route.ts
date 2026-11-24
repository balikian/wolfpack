import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The magic link in the sign-in email lands here with a one-time code.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Only allow same-site relative paths, so the link can't bounce people
  // to another website.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
