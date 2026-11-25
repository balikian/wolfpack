import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { requireMember, type Member } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { isUuid, type Circle, type CircleMembership } from "@/lib/circles";
import { ActionButton } from "@/components/action-button";
import { CircleForm } from "../circle-form";
import { AddMemberForm } from "./add-member-form";
import { ChatRoom } from "@/components/chat/chat-room";
import { loadChat, nameMap } from "@/lib/chat";
import {
  addCircleMember,
  deleteCircle,
  leaveCircle,
  removeCircleMember,
  setCircleManager,
  updateCircle,
} from "../actions";

export const metadata: Metadata = { title: "Circle" };

export default function CirclePage({ params }: PageProps<"/circles/[id]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <nav>
        <Link href="/circles" className="text-sm font-semibold underline">
          ‹ All circles
        </Link>
      </nav>
      <Suspense fallback={<p>Loading…</p>}>
        <CircleContent params={params} />
      </Suspense>
    </main>
  );
}

async function CircleContent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await connection();

  const supabase = await createClient();
  // A secret circle this person isn't in comes back empty, the same as one
  // that doesn't exist.
  const { data: circle } = await supabase
    .from("circles")
    .select("id, name, emoji, kind")
    .eq("id", id)
    .maybeSingle<Circle>();
  if (!circle) notFound();

  const [{ data: memberships }, { data: members }, chat] = await Promise.all([
    supabase
      .from("circle_members")
      .select("circle_id, member_id, is_manager")
      .eq("circle_id", id)
      .returns<CircleMembership[]>(),
    supabase
      .from("members")
      .select("id, display_name, role, status")
      .order("display_name")
      .returns<Member[]>(),
    // Empty unless this person is in the circle (row-level security).
    loadChat({ room: "circle", circleId: id }),
  ]);

  const everyone = members ?? [];
  const rowFor = new Map((memberships ?? []).map((m) => [m.member_id, m]));
  const inCircle = everyone
    .filter((m) => rowFor.has(m.id))
    .map((m) => ({ ...m, isManager: rowFor.get(m.id)!.is_manager }));
  const notInCircle = everyone.filter((m) => m.status === "active" && !rowFor.has(m.id));

  const isAdmin = me.role === "admin";
  const myRow = rowFor.get(me.id);
  const isManager = Boolean(myRow?.is_manager);
  const canAddRemove = isAdmin || isManager;
  const managers = inCircle.filter((m) => m.isManager && m.status === "active");
  const activeCount = inCircle.filter((m) => m.status === "active").length;

  return (
    <>
      <header className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden>
          {circle.emoji ?? "◯"}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-3xl font-black tracking-wide">{circle.name}</h1>
          <p className="text-sm text-muted">
            {circle.kind === "secret"
              ? "Secret circle: only people in it can see it."
              : "Open circle: every member can see it and who's in it."}
          </p>
        </div>
      </header>

      {!myRow && (
        <p className="rounded-md border border-line bg-card p-3 text-sm">
          {isAdmin
            ? "You're not in this circle. As an admin you can manage who's in it, but you won't see what's shared in it unless you add yourself."
            : managers.length > 0
              ? `You're not in this circle. To join, ask ${listNames(managers.map((m) => m.display_name))} or an admin.`
              : "You're not in this circle. To join, ask an admin."}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Who&apos;s in it ({activeCount})
        </h2>
        {inCircle.length === 0 ? (
          <p className="text-muted">Nobody yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
            {inCircle.map((m) => {
              const isMe = m.id === me.id;
              // Admins and managers remove anyone; people remove themselves
              // with "Leave circle" below. The database keeps at least one
              // active manager and explains if a change would remove the last.
              const canRemove = !isMe && canAddRemove;
              const canToggleManager = canAddRemove && m.status === "active";
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={`truncate font-semibold ${m.status === "deactivated" ? "text-muted line-through" : ""}`}
                    >
                      {m.display_name}
                      {isMe && <span className="font-normal text-muted"> (you)</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {m.isManager ? "Manager" : "Member"}
                      {m.status === "deactivated" && " · Deactivated"}
                    </span>
                  </div>
                  {(canToggleManager || canRemove) && (
                    <div className="flex flex-wrap items-start gap-2">
                      {canToggleManager && (
                        <ActionButton
                          action={setCircleManager.bind(null, circle.id, m.id, !m.isManager)}
                          label={
                            m.isManager ? (isMe ? "Step down as manager" : "Remove manager") : "Make manager"
                          }
                          confirmText={
                            m.isManager
                              ? isMe
                                ? `Stop managing ${circle.name}?`
                                : `Remove ${m.display_name} as a manager of ${circle.name}?`
                              : `Make ${m.display_name} a manager of ${circle.name}? Managers can add and remove people and choose other managers.`
                          }
                        />
                      )}
                      {canRemove && (
                        <ActionButton
                          action={removeCircleMember.bind(null, circle.id, m.id)}
                          label="Remove"
                          pendingLabel="Removing…"
                          variant="danger"
                          confirmText={`Remove ${m.display_name} from ${circle.name}? They'll lose access to what's shared in it right away.`}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">
          Managers (and admins) add and remove people and choose other managers.
          Once a circle has a manager, it always keeps at least one.
        </p>
      </section>

      {myRow && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Chat</h2>
          <ChatRoom
            target={{ room: "circle", circleId: circle.id }}
            initial={chat.messages}
            more={chat.more}
            names={nameMap(everyone)}
            meId={me.id}
            isAdmin={isAdmin}
            nowIso={new Date().toISOString()}
            emptyText="No messages yet."
          />
          <p className="text-xs text-muted">Only people in {circle.name} can see this chat.</p>
        </section>
      )}

      {canAddRemove && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Add someone</h2>
          <AddMemberForm
            action={addCircleMember.bind(null, circle.id)}
            people={notInCircle.map(({ id, display_name }) => ({ id, display_name }))}
          />
        </section>
      )}

      {myRow && (
        <section className="flex justify-start">
          <ActionButton
            action={leaveCircle.bind(null, circle.id)}
            label="Leave circle"
            pendingLabel="Leaving…"
            variant="danger"
            confirmText={
              circle.kind === "secret"
                ? `Leave ${circle.name}? It's secret, so you won't see it again unless someone adds you back.`
                : `Leave ${circle.name}?`
            }
          />
        </section>
      )}

      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Circle settings
          </h2>
          <div className="rounded-md border border-line bg-card p-3">
            <CircleForm
              action={updateCircle.bind(null, circle.id)}
              initial={{ name: circle.name, emoji: circle.emoji, kind: circle.kind }}
            />
          </div>
          <div className="flex justify-start">
            <ActionButton
              action={deleteCircle.bind(null, circle.id)}
              label="Delete circle"
              pendingLabel="Deleting…"
              variant="danger"
              confirmText={`Delete ${circle.name}? Everything shared only with this circle will be deleted too. This can't be undone.`}
            />
          </div>
        </section>
      )}
    </>
  );
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}
