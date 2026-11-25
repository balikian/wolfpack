-- Trail link tests. Run after the event_trail_links migration.
--
-- Paste the whole file into the Supabase SQL editor and run it. It creates
-- test people and an event inside one transaction, checks the rules, then
-- rolls everything back.
--
--   * Every check passed: the editor shows one row, "All trail link tests passed".
--   * A check failed: it stops with an error that starts with "FAIL:".
--
-- Test people: B made the event; C is another member.

begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'test-c@example.invalid', 'authenticated', 'authenticated');

insert into public.members (id, display_name, role, status) values
  ('00000000-0000-4000-8000-00000000000b', 'Test B', 'member', 'active'),
  ('00000000-0000-4000-8000-00000000000c', 'Test C', 'member', 'active');

insert into public.events (id, circle_id, created_by, kind, title, starts_at) values
  ('00000000-0000-4000-8000-0000000000e1', null,
   '00000000-0000-4000-8000-00000000000b', 'hike', 'Test hike', now() + interval '1 day');

set local role authenticated;

-- B: the creator can set, change and clear the link; only web links.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare n int;
begin
  with u as (update public.events set trail_url = 'https://www.wta.org/go-hiking/hikes/mailbox-peak'
    where id = '00000000-0000-4000-8000-0000000000e1' returning id) select count(*) into n from u;
  assert n = 1, 'FAIL: B could not add a trail link to their own event';

  begin
    update public.events set trail_url = 'javascript:alert(1)'
      where id = '00000000-0000-4000-8000-0000000000e1';
    raise exception 'FAIL: a javascript: link was saved';
  exception when check_violation then null;
  end;
  begin
    update public.events set trail_url = 'https://www.wta.org/a link with spaces'
      where id = '00000000-0000-4000-8000-0000000000e1';
    raise exception 'FAIL: a link with spaces was saved';
  exception when check_violation then null;
  end;
  begin
    update public.events set trail_url = 'https://www.wta.org/' || repeat('a', 500)
      where id = '00000000-0000-4000-8000-0000000000e1';
    raise exception 'FAIL: a link over 500 characters was saved';
  exception when check_violation then null;
  end;

  insert into public.events (created_by, kind, title, starts_at, trail_url)
    values ('00000000-0000-4000-8000-00000000000b', 'hike', 'Test hike 2', now(),
            'https://www.wta.org/go-hiking/hikes/rattlesnake-ledge');
end $$;

-- C: can't change someone else's link.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare n int;
begin
  with u as (update public.events set trail_url = 'https://example.com/'
    where id = '00000000-0000-4000-8000-0000000000e1' returning id) select count(*) into n from u;
  assert n = 0, 'FAIL: C changed the trail link on B''s event';
end $$;

reset role;

do $$
begin
  assert (select trail_url from public.events where id = '00000000-0000-4000-8000-0000000000e1')
    = 'https://www.wta.org/go-hiking/hikes/mailbox-peak', 'FAIL: the trail link was not kept';
end $$;

select 'All trail link tests passed' as result;

rollback;
