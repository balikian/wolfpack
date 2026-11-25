-- Chat: one room for Everyone, one per circle, one per event.
--
-- Rules:
--   * A room is visible to the same people as what it belongs to: the
--     Everyone room to every active member, a circle's room to people in the
--     circle, an event's room to everyone who can see the event.
--   * People post only as themselves, only in rooms they can see.
--   * A message can be deleted (not edited) by its author or by an admin who
--     can see the room. Deleting blanks the text and keeps a "deleted" marker,
--     so live views update in place.
--   * Deleting a circle or an event deletes its chat (on delete cascade).
--     Never use set null here: a room with no circle would become visible to
--     everyone.
--   * Live updates use Supabase Realtime (Postgres Changes), which applies
--     these same policies to each listener.

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room in ('everyone', 'circle', 'event')),
  circle_id uuid references public.circles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  author_id uuid references public.members (id) on delete set null,
  body text not null default '',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_messages_room_target check (
    (room = 'everyone' and circle_id is null and event_id is null)
    or (room = 'circle' and circle_id is not null and event_id is null)
    or (room = 'event' and event_id is not null and circle_id is null)
  ),
  constraint chat_messages_body check (
    (deleted_at is null and length(trim(body)) between 1 and 4000)
    or (deleted_at is not null and body = '')
  )
);

create index chat_messages_everyone_idx on public.chat_messages (created_at)
  where room = 'everyone';
create index chat_messages_circle_idx on public.chat_messages (circle_id, created_at);
create index chat_messages_event_idx on public.chat_messages (event_id, created_at);
create index chat_messages_author_idx on public.chat_messages (author_id);

-- Can the caller see this room? Runs as the owner so the policies don't
-- depend on the events or circles policies.
create function public.can_see_chat(room text, circle uuid, event uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case room
    when 'everyone' then public.is_active_member()
    when 'circle' then public.is_circle_member(circle)
    when 'event' then public.can_see_event(event)
    else false
  end;
$$;

revoke execute on function public.can_see_chat(text, uuid, uuid) from public, anon;
grant execute on function public.can_see_chat(text, uuid, uuid) to authenticated;

-- Deleting is an update that sets deleted_at. This blanks the text, stamps
-- the time, and refuses to undo a delete.
create function public.chat_message_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    raise exception 'That message was already deleted.' using errcode = 'P0001';
  end if;
  if new.deleted_at is null then
    return old;
  end if;
  new.body := '';
  new.deleted_at := now();
  return new;
end;
$$;

create trigger chat_messages_delete
  before update on public.chat_messages
  for each row execute function public.chat_message_delete();

alter table public.chat_messages enable row level security;

create policy "chat_messages_select_room"
  on public.chat_messages for select to authenticated
  using (public.can_see_chat(room, circle_id, event_id));

create policy "chat_messages_insert_own"
  on public.chat_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and deleted_at is null
    and public.can_see_chat(room, circle_id, event_id)
  );

create policy "chat_messages_delete_author_or_admin"
  on public.chat_messages for update to authenticated
  using (
    public.can_see_chat(room, circle_id, event_id)
    and (author_id = (select auth.uid()) or public.is_admin())
  )
  with check (public.can_see_chat(room, circle_id, event_id));

-- Column grants: nobody picks a message's time or id, moves it to another
-- room, or rewrites it. The only update is setting deleted_at.
revoke insert, update, delete on public.chat_messages from anon, authenticated;
grant insert (room, circle_id, event_id, author_id, body) on public.chat_messages to authenticated;
grant update (deleted_at) on public.chat_messages to authenticated;

-- Send changes to Realtime listeners. (The publication exists on Supabase;
-- the check keeps this migration runnable on a plain Postgres for tests.)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
