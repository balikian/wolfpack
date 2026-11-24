-- Circle managers choose managers, and a circle that has managers always
-- keeps at least one.
--
--   * Admins and a circle's managers can make someone in it a manager or
--     remove that role, including their own. Regular members can't.
--   * Only the manager flag can change; nobody can move a membership row to
--     another circle or person.
--   * Removing the last active manager (by demoting them, removing them or
--     them leaving) is refused, for admins too. Make someone else a manager
--     first. Deleting the whole circle is still allowed.

drop policy "circle_members_update_admin" on public.circle_members;

create policy "circle_members_update_admin_or_manager"
  on public.circle_members for update to authenticated
  using (public.is_admin() or public.is_circle_manager(circle_id))
  with check (public.is_admin() or public.is_circle_manager(circle_id));

revoke update on public.circle_members from authenticated;
grant update (is_manager) on public.circle_members to authenticated;

create function public.keep_a_circle_manager()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Only matters when an active manager is about to stop being one.
  if not old.is_manager or (tg_op = 'UPDATE' and new.is_manager) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- The whole circle or the person is being deleted: nothing to keep.
  if not exists (select 1 from public.circles where id = old.circle_id)
     or not exists (select 1 from public.members where id = old.member_id and status = 'active') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- One change per circle at a time, so two managers can't both step down
  -- at once and leave none.
  perform 1 from public.circles where id = old.circle_id for update;

  if exists (
    select 1
    from public.circle_members cm
    join public.members m on m.id = cm.member_id
    where cm.circle_id = old.circle_id
      and cm.is_manager
      and m.status = 'active'
      and cm.member_id <> old.member_id
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  raise exception 'A circle needs at least one manager. Make someone else a manager first.';
end;
$$;

revoke execute on function public.keep_a_circle_manager() from public, anon, authenticated;

create trigger circle_members_keep_a_manager
  before update or delete on public.circle_members
  for each row execute function public.keep_a_circle_manager();
