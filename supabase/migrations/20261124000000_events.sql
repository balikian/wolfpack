-- Events and hikes, with RSVPs.
--
-- Rules:
--   * An event is shared with Everyone (circle_id is null) or with one
--     circle, checked by public.can_see(circle_id), the same rule as all
--     shared content.
--   * Any active member can create an event for Everyone or for a circle
--     they're in. Admins can't post into a secret circle they aren't in.
--   * The creator and admins can edit or delete an event, as long as they
--     can see it.
--   * Each person sets only their own RSVP, on events they can see.
--   * Deleting a circle deletes its events (on delete cascade). Never use
--     set null here: a null circle_id means Everyone.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles (id) on delete cascade,
  created_by uuid references public.members (id) on delete set null,
  kind text not null default 'other' check (kind in ('hike', 'party', 'hangout', 'other')),
  title text not null check (length(trim(title)) between 1 and 100),
  description text check (length(description) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at > starts_at),
  location_name text check (length(location_name) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  meetup_name text check (length(meetup_name) <= 200),
  meetup_lat double precision check (meetup_lat between -90 and 90),
  meetup_lng double precision check (meetup_lng between -180 and 180),
  meetup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_pin_pair check ((lat is null) = (lng is null)),
  constraint events_meetup_pin_pair check ((meetup_lat is null) = (meetup_lng is null))
);

comment on column public.events.circle_id is
  'null = shared with Everyone; otherwise only members of this circle can see it.';

create index events_starts_at_idx on public.events (starts_at);
create index events_circle_id_idx on public.events (circle_id);

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create index event_rsvps_member_id_idx on public.event_rsvps (member_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create trigger event_rsvps_set_updated_at
  before update on public.event_rsvps
  for each row execute function public.set_updated_at();

-- Can the caller see this event? Runs as the owner so RSVP policies can
-- look up the event's audience without depending on the events policies.
create function public.can_see_event(event uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = event and public.can_see(e.circle_id)
  );
$$;

revoke execute on function public.can_see_event(uuid) from public, anon;
grant execute on function public.can_see_event(uuid) to authenticated;

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

-- events
create policy "events_select_audience"
  on public.events for select to authenticated
  using (public.can_see(circle_id));

create policy "events_insert_member"
  on public.events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_see(circle_id)
  );

create policy "events_update_creator_or_admin"
  on public.events for update to authenticated
  using (
    public.can_see(circle_id)
    and (created_by = (select auth.uid()) or public.is_admin())
  )
  with check (public.can_see(circle_id));

create policy "events_delete_creator_or_admin"
  on public.events for delete to authenticated
  using (
    public.can_see(circle_id)
    and (created_by = (select auth.uid()) or public.is_admin())
  );

-- Nobody can change who created an event or when.
revoke insert, update, delete on public.events from anon;
revoke update on public.events from authenticated;
grant update (
  circle_id, kind, title, description, starts_at, ends_at,
  location_name, lat, lng, meetup_name, meetup_lat, meetup_lng, meetup_at
) on public.events to authenticated;

-- event_rsvps: visible to everyone who can see the event; each person
-- writes only their own.
create policy "event_rsvps_select_audience"
  on public.event_rsvps for select to authenticated
  using (public.can_see_event(event_id));

create policy "event_rsvps_insert_own"
  on public.event_rsvps for insert to authenticated
  with check (member_id = (select auth.uid()) and public.can_see_event(event_id));

create policy "event_rsvps_update_own"
  on public.event_rsvps for update to authenticated
  using (member_id = (select auth.uid()) and public.can_see_event(event_id))
  with check (member_id = (select auth.uid()) and public.can_see_event(event_id));

create policy "event_rsvps_delete_own"
  on public.event_rsvps for delete to authenticated
  using (member_id = (select auth.uid()));

-- (Upserts update every column they send, so update stays granted on the
-- whole row; the policies above pin member_id to the caller.)
revoke insert, update, delete on public.event_rsvps from anon;
