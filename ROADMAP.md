# Roadmap

Plan for Wolfpack, taken from the requirements spec (v1 draft). Work happens in four steps; each step's list is what "done" means for it.

## Stack (agreed)

| Piece | Choice |
| --- | --- |
| App and hosting | Next.js on Vercel |
| Database, auth, file storage | Supabase (Postgres, row-level security, Realtime for chat) |
| Email | Resend (invites, magic-link sign-in, notifications) |
| Maps | Leaflet with free OpenStreetMap tiles |

## Step 1: Requirements and access model

- [x] Requirements spec (v1 draft)
- [x] Create the GitHub repo
- [ ] Answer the open questions below

## Step 2: Confirm stack details

- [ ] Map tiles: confirm free OSM tiles are enough, or pick a tile provider
- [ ] Storage limits: settle the video cap (proposed 500 MB / 10 min per file) against Supabase storage costs
- [ ] Email domain: choose a domain and verify it in Resend

## Step 3: First working version

- [ ] Invite flow: admin enters email, single-use link expires in 7 days
- [ ] Magic-link sign-in through Supabase Auth with Resend SMTP
- [ ] Members directory and admin tools (resend, revoke, deactivate, promote)
- [ ] Circles: open and secret, circle admins, instant loss of access on removal
- [ ] Row-level security on every table, using one shared audience rule (Everyone or one circle)
- [ ] Events and hikes with RSVPs, map pin and optional meetup spot and time
- [ ] Spots: shared with a circle by default, exact coordinates sent only to people who can see them
- [ ] Chat: Everyone room, one room per circle, one per event (Supabase Realtime)

## Step 4: Media and polish

- [ ] Photo and video uploads and albums (private buckets, signed links, GPS stripped)
- [ ] Email notifications, day-before reminders and per-member preferences or a weekly digest
- [ ] Carpools and bring lists
- [ ] Phone-friendly polish and install to home screen
- [ ] Attendance check-in (open until 48 hours after an event ends)
- [ ] Points and leaderboard, with circle events hidden from people outside the circle
- [ ] Trip reports

## Later (not in v1)

- Google sign-in, limited to emails that were already invited
- Phone push notifications
- Private one-to-one messages

## Open questions

1. Who besides Scott should be an admin? (Proposed: Scott plus one backup.)
2. Can members invite others, or only admins? (Proposed: admins only; members can suggest people.)
3. Which domain for the site and for sending email?
4. Is 500 MB / 10 minutes per video OK?
5. Should secret circles be completely invisible to people outside them? (Proposed: yes.)
6. Is "Wolfpack" the site name? Logo concepts and a phone mockup exist; none has been picked.
7. Do the default point values feel right, and is there a prize for the yearly winner?
