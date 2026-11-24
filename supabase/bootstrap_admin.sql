-- Make yourself the first admin. Run once in the Supabase SQL editor, after
-- the access_core migration and after adding yourself under
-- Authentication -> Users.
--
-- Replace both placeholders before running. Don't commit your real email.

insert into public.members (id, display_name, role)
select id, 'YOUR NAME', 'admin'
from auth.users
where email = 'you@example.com'
on conflict (id) do update set role = 'admin', status = 'active';

-- Should return one row with role = admin.
select m.display_name, m.role, m.status, u.email
from public.members m join auth.users u on u.id = m.id;
