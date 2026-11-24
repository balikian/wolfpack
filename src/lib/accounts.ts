import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Account = {
  userId: string;
  /** null when the sign-in account exists but has no members row. */
  memberStatus: "active" | "deactivated" | null;
};

/**
 * Looks up a sign-in account and its membership by email, bypassing
 * row-level security. Server only. There are only a few dozen accounts, so
 * one page of users covers everyone.
 */
export async function findAccountByEmail(
  email: string,
): Promise<{ account: Account | null; error: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    console.error("findAccountByEmail: listUsers failed", error);
    return { account: null, error: true };
  }

  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return { account: null, error: false };

  const { data: row, error: rowError } = await admin
    .from("members")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  if (rowError) {
    console.error("findAccountByEmail: members lookup failed", rowError);
    return { account: null, error: true };
  }

  return {
    account: { userId: user.id, memberStatus: row?.status ?? null },
    error: false,
  };
}
