-- Circle manager tests. Run after the circle managers migration.
--
-- Paste the whole file into the Supabase SQL editor and run it. It works
-- inside one transaction and rolls everything back.
--
--   * Every check passed: the editor shows one row, "All circle manager tests passed".
--   * A check failed: it stops with an error that starts with "FAIL:".
--
-- Test people, all in Test Mushroom Crew (secret):
--   A  admin (not in the circle)
--   B  manager
--   C  member
--   D  deactivated, still marked as a manager

begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'test-c@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000d', 'test-d@example.invalid', 'authenticated', 'authenticated');

insert into public.members (id, display_name, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'Test A', 'admin', 'active'),
  ('00000000-0000-4000-8000-00000000000b', 'Test B', 'member', 'active'),
  ('00000000-0000-4000-8000-00000000000c', 'Test C', 'member', 'active'),
  ('00000000-0000-4000-8000-00000000000d', 'Test D', 'member', 'deactivated');

insert into public.circles (id, name, kind) values
  ('00000000-0000-4000-8000-0000000000c1', 'Test Mushroom Crew', 'secret'),
  ('00000000-0000-4000-8000-0000000000c2', 'Test Other Circle', 'secret');

insert into public.circle_members (circle_id, member_id, is_manager) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000b', true),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000c', false),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000d', true);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- C: regular member
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare n int;
begin
  with u as (update public.circle_members set is_manager = true
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000c'
    returning member_id) select count(*) into n from u;
  assert n = 0, 'FAIL: regular member C made themselves a manager';

  with u as (update public.circle_members set is_manager = false
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000b'
    returning member_id) select count(*) into n from u;
  assert n = 0, 'FAIL: regular member C removed a manager';
end $$;

-- ---------------------------------------------------------------------------
-- B: the only active manager (D is a manager but deactivated)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare n int;
begin
  -- Can't step down or leave while they're the only active manager.
  begin
    update public.circle_members set is_manager = false
      where circle_id = '00000000-0000-4000-8000-0000000000c1'
        and member_id = '00000000-0000-4000-8000-00000000000b';
    raise exception 'FAIL: the last active manager stepped down';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    delete from public.circle_members
      where circle_id = '00000000-0000-4000-8000-0000000000c1'
        and member_id = '00000000-0000-4000-8000-00000000000b';
    raise exception 'FAIL: the last active manager left the circle';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- Only the manager flag can change.
  begin
    update public.circle_members set circle_id = '00000000-0000-4000-8000-0000000000c2'
      where circle_id = '00000000-0000-4000-8000-0000000000c1'
        and member_id = '00000000-0000-4000-8000-00000000000c';
    raise exception 'FAIL: manager B moved a membership to another circle';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.circle_members set member_id = '00000000-0000-4000-8000-00000000000a'
      where circle_id = '00000000-0000-4000-8000-0000000000c1'
        and member_id = '00000000-0000-4000-8000-00000000000c';
    raise exception 'FAIL: manager B handed C''s membership to someone else';
  exception when insufficient_privilege then null;
  end;

  -- Managers choose managers.
  with u as (update public.circle_members set is_manager = true
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000c'
    returning member_id) select count(*) into n from u;
  assert n = 1, 'FAIL: manager B cannot make C a manager';

  -- With C managing too, B can step down.
  with u as (update public.circle_members set is_manager = false
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000b'
    returning member_id) select count(*) into n from u;
  assert n = 1, 'FAIL: manager B cannot step down while C is also a manager';
end $$;

-- ---------------------------------------------------------------------------
-- C: now the only active manager
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare n int;
begin
  -- Managers can remove people.
  with u as (update public.circle_members set is_manager = true
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000b'
    returning member_id) select count(*) into n from u;
  assert n = 1, 'FAIL: new manager C cannot make B a manager again';
  with d as (delete from public.circle_members
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000b'
    returning member_id) select count(*) into n from d;
  assert n = 1, 'FAIL: manager C cannot remove another manager while staying on';
end $$;

-- ---------------------------------------------------------------------------
-- A: admin. The last-manager rule applies to admins too.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  begin
    delete from public.circle_members
      where circle_id = '00000000-0000-4000-8000-0000000000c1'
        and member_id = '00000000-0000-4000-8000-00000000000c';
    raise exception 'FAIL: admin removed the last active manager';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- A deactivated manager doesn't count, so removing one is fine.
  with d as (delete from public.circle_members
    where circle_id = '00000000-0000-4000-8000-0000000000c1'
      and member_id = '00000000-0000-4000-8000-00000000000d'
    returning member_id) select count(*) into n from d;
  assert n = 1, 'FAIL: admin cannot remove a deactivated manager';

  -- Deleting the whole circle is still allowed.
  with d as (delete from public.circles
    where id = '00000000-0000-4000-8000-0000000000c1' returning id) select count(*) into n from d;
  assert n = 1, 'FAIL: admin cannot delete a circle that has a manager';
end $$;

reset role;

do $$
begin
  assert not exists (select 1 from public.circle_members
    where circle_id = '00000000-0000-4000-8000-0000000000c1'),
    'FAIL: deleting a circle left memberships behind';
end $$;

select 'All circle manager tests passed' as result;

rollback;
