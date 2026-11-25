-- Chat tests. Run after the chat migration.
--
-- Paste the whole file into the Supabase SQL editor and run it. It creates
-- test people, circles, events and messages inside one transaction, checks
-- who can read, post and delete what, then rolls everything back.
--
--   * Every check passed: the editor shows one row, "All chat tests passed".
--   * A check failed: it stops with an error that starts with "FAIL:".
--
-- Test people:
--   A  admin; in no circles
--   B  member; in Test Mushroom Crew (secret)
--   C  member; in no circles
--   D  deactivated member; still listed in Test Mushroom Crew
--   E  has a sign-in account but no members row
--
-- Test events: e1 for Everyone; e2 for Test Mushroom Crew.
-- Test messages (all set up directly):
--   m1  Everyone room, by B
--   m2  Test Mushroom Crew's room, by B
--   m3  e2's room (secret circle event), by B
--   m4  e1's room, by C

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
  ('00000000-0000-4000-8000-0000000000c1', 'Test Mushroom Crew', 'secret');

insert into public.circle_members (circle_id, member_id, is_manager) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000b', false),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000d', false);

insert into public.events (id, circle_id, created_by, title, starts_at) values
  ('00000000-0000-4000-8000-0000000000e1', null,
   '00000000-0000-4000-8000-00000000000b', 'Test Everyone hike', now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000c1',
   '00000000-0000-4000-8000-00000000000b', 'Test secret foray', now() + interval '2 days');

insert into public.chat_messages (id, room, circle_id, event_id, author_id, body) values
  ('00000000-0000-4000-8000-0000000000a1', 'everyone', null, null,
   '00000000-0000-4000-8000-00000000000b', 'Test hello everyone'),
  ('00000000-0000-4000-8000-0000000000a2', 'circle', '00000000-0000-4000-8000-0000000000c1', null,
   '00000000-0000-4000-8000-00000000000b', 'Test secret patch is fruiting'),
  ('00000000-0000-4000-8000-0000000000a3', 'event', null, '00000000-0000-4000-8000-0000000000e2',
   '00000000-0000-4000-8000-00000000000b', 'Test bring baskets'),
  ('00000000-0000-4000-8000-0000000000a4', 'event', null, '00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-00000000000c', 'Test who is driving?');

-- Shape rules, checked as the owner so only the constraints apply.
do $$
begin
  begin
    insert into public.chat_messages (room, circle_id, author_id, body)
      values ('everyone', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000b', 'Test');
    raise exception 'FAIL: an Everyone message was tied to a circle';
  exception when check_violation then null;
  end;
  begin
    insert into public.chat_messages (room, author_id, body)
      values ('event', '00000000-0000-4000-8000-00000000000b', 'Test');
    raise exception 'FAIL: an event message with no event was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.chat_messages (room, author_id, body)
      values ('everyone', '00000000-0000-4000-8000-00000000000b', '   ');
    raise exception 'FAIL: a blank message was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.chat_messages (room, author_id, body)
      values ('everyone', '00000000-0000-4000-8000-00000000000b', repeat('a', 4001));
    raise exception 'FAIL: a message over 4,000 characters was saved';
  exception when check_violation then null;
  end;
end $$;

-- From here on, act as a signed-in user. Only the "sub" claim changes.
set local role authenticated;

-- ---------------------------------------------------------------------------
-- E: signed in, but not a member
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.chat_messages) = 0, 'FAIL: E (no members row) can read chat';
  begin
    insert into public.chat_messages (room, author_id, body)
      values ('everyone', '00000000-0000-4000-8000-00000000000e', 'Test E');
    raise exception 'FAIL: E (no members row) posted in the Everyone room';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- D: deactivated, still listed in the secret circle
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.chat_messages) = 0, 'FAIL: D (deactivated) can read chat';
  begin
    insert into public.chat_messages (room, circle_id, author_id, body)
      values ('circle', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000d', 'Test D');
    raise exception 'FAIL: D (deactivated) posted in the secret circle''s room';
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
  assert (select count(*) from public.chat_messages) = 2,
    'FAIL: C should see exactly the Everyone message and the Everyone event''s message';
  assert not exists (select 1 from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a2'),
    'FAIL: C can read a secret circle''s room';
  assert not exists (select 1 from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a3'),
    'FAIL: C can read a secret circle event''s room';

  -- Posting: Everyone and the Everyone event, as themselves only.
  insert into public.chat_messages (room, author_id, body)
    values ('everyone', '00000000-0000-4000-8000-00000000000c', 'Test C says hi');
  insert into public.chat_messages (room, event_id, author_id, body)
    values ('event', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000000c', 'Test I can drive');
  begin
    insert into public.chat_messages (room, author_id, body)
      values ('everyone', '00000000-0000-4000-8000-00000000000b', 'Test forged');
    raise exception 'FAIL: C posted as B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.chat_messages (room, circle_id, author_id, body)
      values ('circle', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000c', 'Test sneak');
    raise exception 'FAIL: C posted in a secret circle''s room';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.chat_messages (room, event_id, author_id, body)
      values ('event', '00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-00000000000c', 'Test sneak');
    raise exception 'FAIL: C posted in a secret circle event''s room';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.chat_messages (room, author_id, body, created_at)
      values ('everyone', '00000000-0000-4000-8000-00000000000c', 'Test backdated', now() - interval '1 year');
    raise exception 'FAIL: C set a message''s time';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.chat_messages (room, author_id, body, deleted_at)
      values ('everyone', '00000000-0000-4000-8000-00000000000c', 'Test', now());
    raise exception 'FAIL: C chose deleted_at when posting';
  exception when insufficient_privilege then null;
  end;

  -- Deleting: not B's message.
  with u as (update public.chat_messages set deleted_at = now()
    where id = '00000000-0000-4000-8000-0000000000a1' returning id) select count(*) into n from u;
  assert n = 0, 'FAIL: C deleted B''s message';

  -- No editing, moving or hard deletes, even of their own message.
  begin
    update public.chat_messages set body = 'Test edited' where id = '00000000-0000-4000-8000-0000000000a4';
    raise exception 'FAIL: C edited a message';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.chat_messages set room = 'everyone', event_id = null
      where id = '00000000-0000-4000-8000-0000000000a4';
    raise exception 'FAIL: C moved a message to another room';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a4';
    raise exception 'FAIL: C hard-deleted a message';
  exception when insufficient_privilege then null;
  end;

  -- Deleting their own: the text is blanked and the time stamped.
  with u as (update public.chat_messages set deleted_at = '2000-01-01'
    where id = '00000000-0000-4000-8000-0000000000a4' returning id) select count(*) into n from u;
  assert n = 1, 'FAIL: C could not delete their own message';
  assert (select body from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a4') = '',
    'FAIL: deleting did not blank the text';
  assert (select deleted_at from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a4')
    > now() - interval '1 minute', 'FAIL: deleting kept a made-up time';

  -- Undoing a delete is refused (with an error, or by changing nothing).
  begin
    update public.chat_messages set deleted_at = null where id = '00000000-0000-4000-8000-0000000000a4';
  exception when raise_exception then null;
  end;
  assert (select deleted_at from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a4')
    is not null, 'FAIL: C undid a delete';
end $$;

-- ---------------------------------------------------------------------------
-- B: member of the secret circle
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.chat_messages) = 6, 'FAIL: B should see all six messages';
  insert into public.chat_messages (room, circle_id, author_id, body)
    values ('circle', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000b', 'Test circle post');
  insert into public.chat_messages (room, event_id, author_id, body)
    values ('event', '00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-00000000000b', 'Test event post');
end $$;

-- ---------------------------------------------------------------------------
-- A: admin, not in the secret circle
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  assert not exists (select 1 from public.chat_messages where circle_id = '00000000-0000-4000-8000-0000000000c1'),
    'FAIL: an admin outside the secret circle can read its room';
  assert not exists (select 1 from public.chat_messages where event_id = '00000000-0000-4000-8000-0000000000e2'),
    'FAIL: an admin outside the secret circle can read its event''s room';

  -- Admins can remove anyone's message in rooms they can see.
  with u as (update public.chat_messages set deleted_at = now()
    where id = '00000000-0000-4000-8000-0000000000a1' returning id) select count(*) into n from u;
  assert n = 1, 'FAIL: an admin could not delete a message in the Everyone room';
  with u as (update public.chat_messages set deleted_at = now()
    where id = '00000000-0000-4000-8000-0000000000a2' returning id) select count(*) into n from u;
  assert n = 0, 'FAIL: an admin deleted a message in a room they can''t see';
end $$;

-- ---------------------------------------------------------------------------
-- Leaving a circle takes its rooms away right away
-- ---------------------------------------------------------------------------
reset role;
delete from public.circle_members
  where circle_id = '00000000-0000-4000-8000-0000000000c1'
    and member_id = '00000000-0000-4000-8000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
begin
  assert not exists (select 1 from public.chat_messages where circle_id = '00000000-0000-4000-8000-0000000000c1'),
    'FAIL: B still reads the circle''s room after leaving it';
  assert not exists (select 1 from public.chat_messages where event_id = '00000000-0000-4000-8000-0000000000e2'),
    'FAIL: B still reads the circle event''s room after leaving the circle';
end $$;

-- ---------------------------------------------------------------------------
-- Deleting an event or a circle deletes its chat (never moves it to Everyone)
-- ---------------------------------------------------------------------------
reset role;

do $$
begin
  delete from public.events where id = '00000000-0000-4000-8000-0000000000e2';
  assert not exists (select 1 from public.chat_messages where event_id = '00000000-0000-4000-8000-0000000000e2'),
    'FAIL: deleting an event did not delete its chat';
  assert not exists (select 1 from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a3'),
    'FAIL: an event''s message survived the event';
  delete from public.circles where id = '00000000-0000-4000-8000-0000000000c1';
  assert not exists (select 1 from public.chat_messages where id = '00000000-0000-4000-8000-0000000000a2'),
    'FAIL: deleting a circle did not delete its chat';
end $$;

select 'All chat tests passed' as result;

rollback;
