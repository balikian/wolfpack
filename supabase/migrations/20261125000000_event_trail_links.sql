-- A link to a hike's trail page, such as its Washington Trails Association
-- (WTA) guide entry. Only web links are allowed, so a saved link can't run
-- script when someone taps it.

alter table public.events
  add column trail_url text
    constraint events_trail_url_web
    check (trail_url ~ '^https?://[^[:space:]]+$' and length(trail_url) <= 500);

comment on column public.events.trail_url is
  'Trail info page for a hike, e.g. its WTA hike page. http(s) only.';

-- Update is granted column by column (see the events migration), so the new
-- column needs its own grant. Row-level security still limits edits to the
-- event's creator and admins.
grant update (trail_url) on public.events to authenticated;
