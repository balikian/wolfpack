import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireMember, type Member } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/action-button";
import { InviteForm } from "./invite-form";
import { revokeInvite, setMemberRole, setMemberStatus } from "./actions";

export const metadata: Metadata = { title: "Members" };

type PendingInvite = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
};

export default function MembersPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black uppercase tracking-wide">Members</h1>
        <Link href="/" className="text-sm font-semibold underline">
          Home
        </Link>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <MembersContent />
      </Suspense>
    </main>
  );
}

async function MembersContent() {
  const me = await requireMember();
  const isAdmin = me.role === "admin";
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, display_name, role, status")
    .order("display_name")
    .returns<Member[]>();

  const { data: invites } = isAdmin
    ? await supabase
        .from("invites")
        .select("id, email, created_at, expires_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .returns<PendingInvite[]>()
    : { data: [] as PendingInvite[] };

  const visible = (members ?? []).filter((m) => isAdmin || m.status === "active");
  const now = new Date();

  return (
    <>
      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Invite someone</h2>
          <InviteForm />
        </section>
      )}

      {isAdmin && (invites?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Pending invites ({invites!.length})
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
            {invites!.map((inv) => {
              const expired = new Date(inv.expires_at) < now;
              return (
                <li key={inv.id} className="flex flex-col gap-2 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{inv.email}</span>
                    <span className={`shrink-0 text-xs ${expired ? "text-danger" : "text-muted"}`}>
                      {expired ? "Expired" : `Sent ${formatDay(inv.created_at)}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <InviteForm fixedEmail={inv.email} />
                    <ActionButton
                      action={revokeInvite.bind(null, inv.id)}
                      label="Cancel"
                      pendingLabel="Cancelling…"
                      variant="danger"
                      confirmText={`Cancel the invite for ${inv.email}?`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          The pack ({visible.filter((m) => m.status === "active").length})
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
          {visible.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex min-w-0 flex-col">
                <span className={`truncate font-semibold ${m.status === "deactivated" ? "text-muted line-through" : ""}`}>
                  {m.display_name}
                  {m.id === me.id && <span className="font-normal text-muted"> (you)</span>}
                </span>
                <span className="text-xs text-muted">
                  {m.role === "admin" ? "Admin" : "Member"}
                  {m.status === "deactivated" && " · Deactivated"}
                </span>
              </div>

              {isAdmin && m.id !== me.id && (
                <div className="flex flex-wrap items-start gap-2">
                  {m.status === "active" &&
                    (m.role === "admin" ? (
                      <ActionButton
                        action={setMemberRole.bind(null, m.id, "member")}
                        label="Remove admin"
                        confirmText={`Remove admin rights from ${m.display_name}?`}
                      />
                    ) : (
                      <ActionButton
                        action={setMemberRole.bind(null, m.id, "admin")}
                        label="Make admin"
                        confirmText={`Make ${m.display_name} an admin? Admins can invite and remove people.`}
                      />
                    ))}
                  {m.status === "active" ? (
                    <ActionButton
                      action={setMemberStatus.bind(null, m.id, "deactivated")}
                      label="Deactivate"
                      variant="danger"
                      confirmText={`Deactivate ${m.display_name}? They'll lose access right away and can't sign in.`}
                    />
                  ) : (
                    <ActionButton
                      action={setMemberStatus.bind(null, m.id, "active")}
                      label="Reactivate"
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
