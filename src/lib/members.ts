import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Member = {
  id: string;
  display_name: string;
  role: "admin" | "member";
  status: "active" | "deactivated";
};

/**
 * The signed-in person's members row, or null. Row-level security only
 * returns rows to active members, so a deactivated person or an account
 * without a members row gets null too. Cached for the rest of the request.
 */
export const getCurrentMember = cache(
  async (): Promise<{ signedIn: boolean; member: Member | null }> => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) return { signedIn: false, member: null };

    const { data: member } = await supabase
      .from("members")
      .select("id, display_name, role, status")
      .eq("id", userId)
      .maybeSingle<Member>();

    return {
      signedIn: true,
      member: member?.status === "active" ? member : null,
    };
  },
);

/** For pages and actions that need an active member. */
export async function requireMember(): Promise<Member> {
  const { signedIn, member } = await getCurrentMember();
  if (!signedIn) redirect("/login");
  if (!member) redirect("/no-access");
  return member;
}

/** For admin-only pages and actions. */
export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (member.role !== "admin") redirect("/");
  return member;
}
