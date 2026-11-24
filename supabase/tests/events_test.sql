-- Events tests. Run after the events migration.
--
-- Paste the whole file into the Supabase SQL editor and run it. It creates
-- test people, circles and events inside one transaction, checks who can see
-- and change what, then rolls everything back.
--
--   * Every check passed: the editor shows one row, "All events tests passed".
--   * A check failed: it stops with an error that starts with "FAIL:".
--
-- Test people:
--   A  admin; in no circles
--   B  member; in Test Mushroom Crew (secret) and manager of Test Party Planners (open)
--   C  member; in no circles
--   D  deactivated member; still listed in Test Mushroom Crew
--   E  has a sign-in account but no members row
--
-- Test events, all created by B:
--   e1  Everyone
--   e2  Test Mushroom Crew (secret)
--   e3  Test Party Planners (open circle: only its members see its events)

begin;

-- ---------------------------------------------------------------------------
-- Setup (runs as the database owner, so row-level security doesn't apply)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'test-c@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000d', 'test-d@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000e', 'test-e@example.invalid', 'authenticated', 'authenticated');

insert into public.members (id, display_name, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'Test A', 'admin', 'active'),
  ('00000000-0000-4000-8000-00000000000b', 'Test B', 'member', 'active'),
  ('00000000-0000-4000-8000-00000000000c', 'Test C', 'member', 'active'),
  ('00000000-0000-4000-8000-00000000000d', 'Test D', 'member', 'deactivated');

insert into public.circles (id, name, kind) values
  ('00000000-0000-4000-8000-0000000000c1', 'Test Mushroom Crew', 'secret'),
  ('00000000-0000-4000-8000-0000000000c2', 'Test Party Planners', 'open');

insert into public.circle_members (circle_id, member_id, is_manager) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000b', false),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000d', false),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-00000000000b', true);

insert into public.events (id, circle_id, created_by, title, starts_at, lat, lng) values
  ('00000000-0000-4000-8000-0000000000e1', null,
   '00000000-0000-4000-8000-00000000000b', 'Test Everyone hike', now() + interval '1 day', 45.5, -122.6),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000c1',
   '00000000-0000-4000-8000-00000000000b', 'Test secret foray', now() + interval '2 days', 45.6, -122.7),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000c2',
   '00000000-0000-4000-8000-00000000000b', 'Test planners meeting', now() + interval '3 days', null, null);

insert into public.event_rsvps (event_id, member_id, status) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000000b', 'going'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-00000000000b', 'going');

-- From here on, act as a signed-in user. Only the "sub" claim changes.
set local role authenticated;

-- ---------------------------------------------------------------------------
-- E: signed in, but not a member
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.events) = 0, 'FAIL: E (no members row) can read events';
  assert (select count(*) from public.event_rsvps) = 0, 'FAIL: E (no members row) can read RSVPs';
  begin
    insert into public.events (created_by, title, starts_at)
      values ('00000000-0000-4000-8000-00000000000e', 'Test E event', now());
    raise exception 'FAIL: E (no members row) created an event';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- D: deactivated, still listed in the secret circle
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.events) = 0, 'FAIL: D (deactivated) can read events';
  assert not public.can_see_event('00000000-0000-4000-8000-0000000000e2'),
    'FAIL: D (deactivated) passes can_see_event for the secret event';
  begin
    insert into public.events (created_by, title, starts_at)
      values ('00000000-0000-4000-8000-00000000000d', 'Test D event', now());
    raise exception 'FAIL: D (deactivated) created an event';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- C: member in no circles
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare n int;
begin
  assert (select count(*) from public.events) = 1, 'FAIL: C should see exactly the Everyone event';
  assert exists (select 1 from public.events where id = '00000000-0000-4000-8000-0000000000e1'),
    'FAIL: C cannot see the Everyone event';
  assert not exists (select 1 from public.events where id = '00000000-0000-4000-8000-0000000000e3'),
    'FAIL: C can see an open circle''s event without being in the circle';
  assert (select count(*) from public.event_rsvps) = 1,
    'FAIL: C should see only the Everyone event''s RSVPs';

  -- Creating: Everyone is fine, as themselves only, and not into a circle they're not in.
  insert into public.events (id, created_by, title, starts_at)
    values ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-00000000000c',
            'Test C picnic', now() + interval '4 days');
  begin
    insert into public.events (created_by, title, starts_at)
      values ('00000000-0000-4000-8000-00000000000b', 'Test forged', now());
    raise exception 'FAIL: C created an event as B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.events (circle_id, created_by, title, starts_at)
      values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000c', 'Test sneak', now());
    raise exception 'FAIL: C created an event in a secret circle they are not in';
  exception when insufficient_privilege then null;
  end;

  -- Editing and deleting: not someone else's event.
  with u as (update public.events set title = 'Test hijack'
    where id = '00000000-0000-4000-8000-0000000000e1' returning id) select count(*) into n from u;
  assert n = 0, 'FAIL: C edited B''s event';
  with d as (delete from public.events
    where id = '00000000-0000-4000-8000-0000000000e1' returning id) select count(*) into n from d;
  assert n = 0, 'FAIL: C deleted B''s event';

  -- Their own event: can edit, can't change who created it.
  with u as (update public.events set title = 'Test C picnic, moved'
    where id = '00000000-0000-4000-8000-0000000000e4' returning id) select count(*) into n from u;
  assert n = 1, 'FAIL: C cannot edit their own event';
  begin
    update public.events set created_by = '00000000-0000-4000-8000-00000000000b'
      where id = '00000000-0000-4000-8000-0000000000e4';
    raise exception 'FAIL: C changed created_by';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.events set circle_id = '00000000-0000-4000-8000-0000000000c1'
      where id = '00000000-0000-4000-8000-0000000000e4';
    raise exception 'FAIL: C moved their event into a circle they are not in';
  exception when insufficient_privilege then null;
  end;

  -- RSVPs: own row only, only on events they can see.
  insert into public.event_rsvps (event_id, member_id, status)
    values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000000c', 'maybe');
  insert into public.event_rsvps (event_id, member_id, status)
    values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000000c', 'going')
    on conflict (event_id, member_id) do update set status = excluded.status;
  assert (select status from public.event_rsvps
          where event_id = '00000000-0000-4000-8000-0000000000e1'
            and member_id = '00000000-0000-4000-8000-00000000000c') = 'going',
    'FAIL: C cannot change their RSVP with an upsert';
  begin
    insert into public.event_rsvps (event_id, member_id, status)
      values ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-00000000000c', 'going');
    raise exception 'FAIL: C RSVPed to a secret event';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.event_rsvps (event_id, member_id, status)
      values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000000a', 'no');
    raise exception 'FAIL: C wrote an RSVP for someone else';
  exception when insufficient_privilege then null;
  end;
  with u as (update public.event_rsvps set status = 'no'
    where member_id = '00000000-0000-4000-8000-00000000000b' returning event_id) select count(*) into n from u;
  assert n = 0, 'FAIL: C changed B''s RSVP';
  with d as (delete from public.event_rsvps
    where member_id = '00000000-0000-4000-8000-00000000000b' returning event_id) select count(*) into n from d;
  assert n = 0, 'FAIL: C deleted B''s RSVP';
end $$;

-- ---------------------------------------------------------------------------
-- A: admin, in no circles
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  assert (select count(*) from public.events) = 2, 'FAIL: A should see only the two Everyone events';
  assert not exists (select 1 from public.events where id = '00000000-0000-4000-8000-0000000000e2'),
    'FAIL: admin A can see a secret circle''s event without being in it';
  assert not exists (select 1 from public.event_rsvps where event_id = '00000000-0000-4000-8000-0000000000e2'),
    'FAIL: admin A can see RSVPs for a secret circle''s event';

  with u as (update public.events set title = 'Test admin edit'
    where id = '00000000-0000-4000-8000-0000000000e2' returning id) select count(*) into n from u;
  assert n = 0, 'FAIL: admin A edited a secret circle''s event';
  begin
    insert into public.events (circle_id, created_by, title, starts_at)
      values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000a', 'Test admin post', now());
    raise exception 'FAIL: admin A posted into a secret circle they are not in';
  exception when insufficient_privilege then null;
  end;

  -- Admins can edit and delete Everyone events made by others.
  with u as (update public.events set title = 'Test tidied by admin'
    where id = '00000000-0000-4000-8000-0000000000e1' returning id) select count(*) into n from u;
  assert n = 1, 'FAIL: admin A cannot edit an Everyone event';
  with d as (delete from public.events
    where id = '00000000-0000-4000-8000-0000000000e4' returning id) select count(*) into n from d;
  assert n = 1, 'FAIL: admin A cannot delete an Everyone event';
  assert not exists (select 1 from public.event_rsvps where event_id = '00000000-0000-4000-8000-0000000000e4'),
    'FAIL: deleting an event left its RSVPs behind';
end $$;

-- ---------------------------------------------------------------------------
-- B: in the secret circle and the open circle
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.events) = 3, 'FAIL: B should see all three events';
  assert (select count(*) from public.event_rsvps where event_id = '00000000-0000-4000-8000-0000000000e2') = 1,
    'FAIL: B cannot see the secret event''s RSVPs';

  -- Leaving the secret circle cuts off its events at once.
  delete from public.circle_members
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000b';
  assert not exists (select 1 from public.events where id = '00000000-0000-4000-8000-0000000000e2'),
    'FAIL: B still sees the secret event after leaving the circle';
  assert not public.can_see_event('00000000-0000-4000-8000-0000000000e2'),
    'FAIL: B still passes can_see_event after leaving the circle';
end $$;

-- ---------------------------------------------------------------------------
-- Deleting a circle deletes its events (never turns them into Everyone events)
-- ---------------------------------------------------------------------------
reset role;

do $$
begin
  delete from public.circles where id = '00000000-0000-4000-8000-0000000000c1';
  assert not exists (select 1 from public.events where id = '00000000-0000-4000-8000-0000000000e2'),
    'FAIL: deleting a circle did not delete its events';
end $$;

select 'All events tests passed' as result;

rollback;
