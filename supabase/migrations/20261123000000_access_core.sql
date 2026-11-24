-- Access core: members, invites, circles, circle membership and the audit log,
-- plus the visibility rule that every later table reuses.
--
-- Rules this file enforces (see ROADMAP.md and the requirements spec):
--   * Nobody sees anything unless they have an ACTIVE row in public.members.
--     A Supabase auth account on its own grants nothing.
--   * Content is shared with Everyone (circle_id is null) or with one circle.
--     public.can_see(circle_id) is the single rule for that; later tables
--     (events, spots, posts, media, chat) call it from their policies.
--   * Secret circles are invisible to non-members. Open circles are visible to
--     every active member so they can ask to join.
--   * Removing someone from a circle takes effect immediately, because every
--     check reads circle_members live.
--   * Admin actions (invites, circle and membership changes, role and status
--     changes) are written to public.audit_log by triggers.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  avatar_path text,
  phone text,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'active' check (status in ('active', 'deactivated')),
  hide_from_leaderboard boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.members is
  'One row per person in the group. Created when an invite is accepted.';

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 40),
  emoji text,
  kind text not null default 'secret' check (kind in ('open', 'secret')),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.circles.kind is
  'open: every member can see it and ask to join. secret: invisible to non-members.';

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  is_manager boolean not null default false,
  added_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (circle_id, member_id)
);

create index circle_members_member_id_idx on public.circle_members (member_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  invited_by uuid references public.members (id) on delete set null,
  -- Only a hash of the emailed token is stored, never the token itself.
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.invites.status is
  'A pending invite past expires_at counts as expired; there is no separate status.';

create unique index invites_one_pending_per_email
  on public.invites (email) where status = 'pending';

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,  -- auth.uid() at the time; null for dashboard or server jobs
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Visibility helpers
-- These run as the function owner so they can read members/circle_members
-- without tripping those tables' own policies. Each one only answers a
-- question about the caller.
-- ---------------------------------------------------------------------------

create function public.is_active_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.id = (select auth.uid()) and m.status = 'active'
  );
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.id = (select auth.uid()) and m.status = 'active' and m.role = 'admin'
  );
$$;

create function public.is_circle_member(circle uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.circle_members cm
    where cm.circle_id = circle and cm.member_id = (select auth.uid())
  );
$$;

create function public.is_circle_manager(circle uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.circle_members cm
    where cm.circle_id = circle and cm.member_id = (select auth.uid()) and cm.is_manager
  );
$$;

-- Can the caller see that this circle exists (its name and who is in it)?
-- Admins can, so they can manage circles. This does NOT let admins read a
-- secret circle's content; content uses can_see().
create function public.can_view_circle(circle uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
    or public.is_circle_member(circle)
    or (public.is_active_member() and exists (
      select 1 from public.circles c where c.id = circle and c.kind = 'open'
    ));
$$;

-- THE visibility rule for shared content. circle_id null means Everyone.
create function public.can_see(circle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when circle_id is null then public.is_active_member()
    else public.is_circle_member(circle_id)
  end;
$$;

revoke execute on function
  public.is_active_member(), public.is_admin(),
  public.is_circle_member(uuid), public.is_circle_manager(uuid),
  public.can_view_circle(uuid), public.can_see(uuid)
from public, anon;

grant execute on function
  public.is_active_member(), public.is_admin(),
  public.is_circle_member(uuid), public.is_circle_manager(uuid),
  public.can_view_circle(uuid), public.can_see(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.invites enable row level security;
alter table public.audit_log enable row level security;

-- members: the directory is visible to active members. People edit only their
-- own profile fields; role and status change only through the admin functions
-- below. New rows are created by the server when an invite is accepted.
create policy "members_select_active_members"
  on public.members for select to authenticated
  using (public.is_active_member());

create policy "members_update_own_profile"
  on public.members for update to authenticated
  using (id = (select auth.uid()) and public.is_active_member())
  with check (id = (select auth.uid()));

revoke insert, update, delete on public.members from anon, authenticated;
grant update (display_name, avatar_path, phone, hide_from_leaderboard)
  on public.members to authenticated;

-- circles
create policy "circles_select_visible"
  on public.circles for select to authenticated
  using (public.can_view_circle(id));

create policy "circles_insert_admin"
  on public.circles for insert to authenticated
  with check (public.is_admin());

-- Admins only: a manager who could edit the circle could also switch a secret
-- circle to open and expose it.
create policy "circles_update_admin"
  on public.circles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "circles_delete_admin"
  on public.circles for delete to authenticated
  using (public.is_admin());

-- circle_members: visible wherever the circle is visible. Admins and circle
-- managers add and remove people; only admins make someone a manager.
-- Anyone can leave a circle themselves.
create policy "circle_members_select_visible"
  on public.circle_members for select to authenticated
  using (public.can_view_circle(circle_id));

create policy "circle_members_insert_admin_or_manager"
  on public.circle_members for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_circle_manager(circle_id) and not is_manager)
  );

create policy "circle_members_update_admin"
  on public.circle_members for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "circle_members_delete_admin_manager_or_self"
  on public.circle_members for delete to authenticated
  using (
    public.is_admin()
    or public.is_circle_manager(circle_id)
    or member_id = (select auth.uid())
  );

-- invites: admins only (decision for open question 2: only admins invite).
create policy "invites_select_admin"
  on public.invites for select to authenticated
  using (public.is_admin());

create policy "invites_insert_admin"
  on public.invites for insert to authenticated
  with check (public.is_admin() and invited_by = (select auth.uid()));

create policy "invites_update_admin"
  on public.invites for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- audit_log: admins read it; rows are written only by the triggers below.
create policy "audit_log_select_admin"
  on public.audit_log for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin functions for role and status (columns members can't update directly)
-- ---------------------------------------------------------------------------

create function public.admin_set_member_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if new_role not in ('admin', 'member') then
    raise exception 'Unknown role: %', new_role using errcode = '22023';
  end if;
  if new_role = 'member' and not exists (
    select 1 from public.members
    where role = 'admin' and status = 'active' and id <> target
  ) then
    raise exception 'The group needs at least one active admin' using errcode = 'P0001';
  end if;

  update public.members set role = new_role where id = target;
  if not found then
    raise exception 'No such member' using errcode = 'P0002';
  end if;
end;
$$;

-- Deactivating blocks access at once (every policy checks status). Signing the
-- person out of existing sessions is done by the server with the auth admin API.
create function public.admin_set_member_status(target uuid, new_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change member status' using errcode = '42501';
  end if;
  if new_status not in ('active', 'deactivated') then
    raise exception 'Unknown status: %', new_status using errcode = '22023';
  end if;
  if new_status = 'deactivated' and target = (select auth.uid()) then
    raise exception 'You can''t deactivate yourself' using errcode = 'P0001';
  end if;
  if new_status = 'deactivated' and not exists (
    select 1 from public.members
    where role = 'admin' and status = 'active' and id <> target
  ) then
    raise exception 'The group needs at least one active admin' using errcode = 'P0001';
  end if;

  update public.members set status = new_status where id = target;
  if not found then
    raise exception 'No such member' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function
  public.admin_set_member_role(uuid, text), public.admin_set_member_status(uuid, text)
from public, anon;
grant execute on function
  public.admin_set_member_role(uuid, text), public.admin_set_member_status(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at and the audit log
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create trigger invites_set_updated_at
  before update on public.invites
  for each row execute function public.set_updated_at();

create function public.write_audit_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'token_hash' end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'token_hash' end;
begin
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(new_row ->> 'id', old_row ->> 'id'),
    jsonb_strip_nulls(jsonb_build_object('old', old_row, 'new', new_row))
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.write_audit_log() from public, anon, authenticated;

create trigger invites_audit
  after insert or update or delete on public.invites
  for each row execute function public.write_audit_log();

create trigger circles_audit
  after insert or update or delete on public.circles
  for each row execute function public.write_audit_log();

create trigger circle_members_audit
  after insert or update or delete on public.circle_members
  for each row execute function public.write_audit_log();

create trigger members_audit_insert
  after insert on public.members
  for each row execute function public.write_audit_log();

create trigger members_audit_role_status
  after update of role, status on public.members
  for each row execute function public.write_audit_log();
