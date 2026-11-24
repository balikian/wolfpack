-- Access-core tests.
--
-- Paste the whole file into the Supabase SQL editor and run it. It creates
-- test people and circles inside one transaction, checks what each person can
-- and can't do, then rolls everything back, so nothing is left behind.
--
--   * Every check passed: the editor shows one row, "All access tests passed".
--   * A check failed: it stops with an error that starts with "FAIL:".
--
-- Test people:
--   A  admin
--   B  member; in Test Mushroom Crew (secret) and manager of Test Party Planners (open)
--   C  member; in no circles
--   D  deactivated member; still listed in Test Mushroom Crew
--   E  has a sign-in account but no members row (for example a stray sign-up)

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

-- From here on, act as a signed-in user. Only the "sub" claim changes.
set local role authenticated;

-- ---------------------------------------------------------------------------
-- E: signed in, but not a member
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.members) = 0,
    'FAIL: E (no members row) can read members';
  assert (select count(*) from public.circles) = 0,
    'FAIL: E (no members row) can read circles';
  assert (select count(*) from public.circle_members) = 0,
    'FAIL: E (no members row) can read circle_members';
  assert not public.can_see(null),
    'FAIL: E (no members row) passes the Everyone rule';
end $$;

-- ---------------------------------------------------------------------------
-- D: deactivated member
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.members) = 0,
    'FAIL: D (deactivated) can read members';
  assert (select count(*) from public.circles) = 0,
    'FAIL: D (deactivated) can read circles';
  assert not public.can_see(null),
    'FAIL: D (deactivated) passes the Everyone rule';
  assert not public.can_see('00000000-0000-4000-8000-0000000000c1'),
    'FAIL: D (deactivated) can still see Mushroom Crew content';
end $$;

-- ---------------------------------------------------------------------------
-- C: active member in no circles
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  -- Reading
  assert (select count(*) from public.members
          where id::text like '00000000-0000-4000-8000-00000000000_') = 4,
    'FAIL: C can''t read the member directory';
  assert exists (select 1 from public.circles where id = '00000000-0000-4000-8000-0000000000c2'),
    'FAIL: C can''t see the open circle';
  assert not exists (select 1 from public.circles where id = '00000000-0000-4000-8000-0000000000c1'),
    'FAIL: C can see the secret circle';
  assert (select count(*) from public.circle_members
          where circle_id = '00000000-0000-4000-8000-0000000000c1') = 0,
    'FAIL: C can see who is in the secret circle';
  assert public.can_see(null),
    'FAIL: C fails the Everyone rule';
  assert not public.can_see('00000000-0000-4000-8000-0000000000c1'),
    'FAIL: C can see secret-circle content';
  assert not public.can_see('00000000-0000-4000-8000-0000000000c2'),
    'FAIL: C can see open-circle content without joining';
  assert (select count(*) from public.invites) = 0,
    'FAIL: C can read invites';
  assert (select count(*) from public.audit_log) = 0,
    'FAIL: C can read the audit log';

  -- Own profile: allowed
  update public.members set display_name = 'Test C renamed'
    where id = '00000000-0000-4000-8000-00000000000c';
  get diagnostics n = row_count;
  assert n = 1, 'FAIL: C can''t edit their own display name';

  -- Someone else's profile: silently matches nothing
  update public.members set display_name = 'hacked'
    where id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL: C edited B''s profile';

  -- Own role: refused by column permissions
  begin
    update public.members set role = 'admin'
      where id = '00000000-0000-4000-8000-00000000000c';
    raise exception 'FAIL: C made themselves an admin';
  exception when insufficient_privilege then null;
  end;

  -- Admin function: refused
  begin
    perform public.admin_set_member_role('00000000-0000-4000-8000-00000000000c', 'admin');
    raise exception 'FAIL: C called admin_set_member_role';
  exception when insufficient_privilege then null;
  end;

  -- Create a circle: refused
  begin
    insert into public.circles (name) values ('Test sneaky circle');
    raise exception 'FAIL: C created a circle';
  exception when insufficient_privilege then null;
  end;

  -- Join the secret circle: refused
  begin
    insert into public.circle_members (circle_id, member_id)
      values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000c');
    raise exception 'FAIL: C added themselves to the secret circle';
  exception when insufficient_privilege then null;
  end;

  -- Send an invite: refused
  begin
    insert into public.invites (email, invited_by, token_hash)
      values ('friend@example.invalid', '00000000-0000-4000-8000-00000000000c', 'test-hash-c');
    raise exception 'FAIL: C created an invite';
  exception when insufficient_privilege then null;
  end;

  -- Write the audit log directly: refused
  begin
    insert into public.audit_log (action, target_table) values ('fake', 'members');
    raise exception 'FAIL: C wrote to the audit log';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- B: in the secret circle, manager of the open circle
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  assert exists (select 1 from public.circles where id = '00000000-0000-4000-8000-0000000000c1'),
    'FAIL: B can''t see their own secret circle';
  assert (select count(*) from public.circle_members
          where circle_id = '00000000-0000-4000-8000-0000000000c1') = 2,
    'FAIL: B can''t see who is in their secret circle';
  assert public.can_see('00000000-0000-4000-8000-0000000000c1'),
    'FAIL: B can''t see their secret circle''s content';

  -- Manager adds C to the open circle: allowed
  insert into public.circle_members (circle_id, member_id)
    values ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-00000000000c');

  -- (Managers choosing managers is checked in circle_managers_test.sql.)

  -- Non-manager adds C to the secret circle: refused
  begin
    insert into public.circle_members (circle_id, member_id)
      values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000c');
    raise exception 'FAIL: B (not a manager) added C to the secret circle';
  exception when insufficient_privilege then null;
  end;

  -- Manager switches the circle from open to secret (or back): refused
  update public.circles set kind = 'secret'
    where id = '00000000-0000-4000-8000-0000000000c2';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL: manager B changed a circle''s settings';
end $$;

-- ---------------------------------------------------------------------------
-- A: admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  assert exists (select 1 from public.circles where id = '00000000-0000-4000-8000-0000000000c1'),
    'FAIL: admin can''t see the secret circle to manage it';
  assert (select count(*) from public.circle_members
          where circle_id = '00000000-0000-4000-8000-0000000000c1') = 2,
    'FAIL: admin can''t see secret circle membership';
  assert not public.can_see('00000000-0000-4000-8000-0000000000c1'),
    'FAIL: admin who isn''t in the secret circle can see its content';

  -- Invite someone: allowed
  insert into public.invites (email, invited_by, token_hash)
    values ('friend@example.invalid', '00000000-0000-4000-8000-00000000000a', 'test-hash-a');
  assert (select count(*) from public.invites where email = 'friend@example.invalid') = 1,
    'FAIL: admin can''t see the invite they sent';

  -- Remove B from the secret circle: allowed
  delete from public.circle_members
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  assert n = 1, 'FAIL: admin couldn''t remove B from the secret circle';

  -- Deactivate C: allowed
  perform public.admin_set_member_status('00000000-0000-4000-8000-00000000000c', 'deactivated');

  -- Deactivate yourself: refused
  begin
    perform public.admin_set_member_status('00000000-0000-4000-8000-00000000000a', 'deactivated');
    raise exception 'FAIL: admin deactivated themselves';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- Demote the last admin: refused. Skipped if the real project already has
  -- another active admin (for example you, after running bootstrap_admin.sql).
  if not exists (
    select 1 from public.members
    where role = 'admin' and status = 'active'
      and id <> '00000000-0000-4000-8000-00000000000a'
  ) then
    begin
      perform public.admin_set_member_role('00000000-0000-4000-8000-00000000000a', 'member');
      raise exception 'FAIL: the last admin was demoted';
    exception when raise_exception then
      if sqlerrm like 'FAIL:%' then raise; end if;
    end;
  end if;

  -- The audit log recorded this run's changes, without invite token hashes.
  assert (select count(*) from public.audit_log
          where created_at = now() and target_table = 'circle_members' and action = 'delete') >= 1,
    'FAIL: removing B from the circle wasn''t logged';
  assert (select count(*) from public.audit_log
          where created_at = now() and target_table = 'invites') >= 1,
    'FAIL: the invite wasn''t logged';
  assert not exists (select 1 from public.audit_log
          where created_at = now() and details::text like '%token_hash%'),
    'FAIL: the audit log stored an invite token hash';
end $$;

-- ---------------------------------------------------------------------------
-- Changes take effect immediately
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
begin
  assert not public.can_see('00000000-0000-4000-8000-0000000000c1'),
    'FAIL: B still sees secret-circle content after being removed';
  assert not exists (select 1 from public.circles where id = '00000000-0000-4000-8000-0000000000c1'),
    'FAIL: B can still see the secret circle after being removed';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.members) = 0,
    'FAIL: C can still read members after being deactivated';
  assert not public.can_see(null),
    'FAIL: C still passes the Everyone rule after being deactivated';
end $$;

-- Only reached if every check above passed. The SQL editor shows this row.
select 'All access tests passed' as result;

rollback;
