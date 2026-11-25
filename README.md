# Wolfpack

A private, invite-only website for one group of friends (up to about 30 people) to plan hikes, parties and get-togethers, chat, and share photos and video. Secret spots such as fishing holes and mushroom patches stay visible only to the circles allowed to see them.

Built with Next.js 16 on Vercel, Supabase, Resend and Leaflet with OpenStreetMap tiles. Place search uses Photon (photon.komoot.io), a free OpenStreetMap search service; please keep its use light.

## Status

Step 3 has started: sign-in with an emailed magic link works, and every page except `/login` requires a signed-in member. See [ROADMAP.md](ROADMAP.md) for what's next.

## Run it locally

Needs Node 22 or newer.

```sh
git clone https://github.com/balikian/wolfpack.git
cd wolfpack
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npm run dev
```

Open http://localhost:3000.

To test as different people without waiting for emails, set `DEV_ACCOUNT_SWITCHER=on` in `.env.local` (it also needs `SUPABASE_SECRET_KEY`). Then the home and sign-in pages link to `/dev/switch`, which signs you in as any member with one click. It works only under `npm run dev`; production builds, including Vercel's, turn it off.

## Supabase settings

Set these in the Supabase dashboard:

- **Authentication → Sign In / Providers:** turn off "Allow new users to sign up". People join only through invites.
- **Authentication → URL Configuration:** set Site URL to `https://www.wolfpackindustries.club`, and add `http://localhost:3000/**`, `https://wolfpackindustries.club/**` and `https://www.wolfpackindustries.club/**` to the redirect URLs.
- **Authentication → Emails → Templates → Magic Link:** use the subject and body in `supabase/email-templates/magic-link.html`. The link opens on whichever site it was requested from, so sign-in works on localhost too. The link goes to `/auth/confirm`, whose page signs in with a script once it opens in a browser, so scanners that only fetch the link can't use it up, and it works in any browser.
- **Authentication → Emails → SMTP Settings:** custom SMTP through Resend (`smtp.resend.com`, port 465, username `resend`, password = a Resend API key with sending access to `mail.wolfpackindustries.club` only), sender `no-reply@mail.wolfpackindustries.club`.
- **Authentication → Users:** add yourself with "Add user" so you can sign in before the invite flow exists.

## Database

SQL lives in `supabase/`:

- `migrations/`: schema changes, applied in filename order. Paste each new one into the Supabase SQL editor and run it once.
- `tests/`: checks the access rules (who can see and change what), one file per migration: `access_core_test.sql`, `events_test.sql`, `circle_managers_test.sql`, `event_trail_links_test.sql` and `chat_test.sql`. They check the rules as of the latest migration, so run them after all migrations. Safe to run on the live project at any time: each works inside one transaction and rolls everything back. A single row saying "All … tests passed" means every check passed; a failure stops with a message starting `FAIL:`.
- `bootstrap_admin.sql`: run once to make yourself the first admin. Fill in your name and email in the editor; don't commit them.

How access works: a sign-in account alone grants nothing. A person needs an active row in `members`. Shared content is visible to Everyone (`circle_id` is null) or to one circle, checked by `public.can_see(circle_id)`. Secret circles are invisible to non-members, and admins can manage a secret circle's membership without seeing its content.

## Environment variables

| Name | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (safe in the browser; data is protected by row-level security) |
| `NEXT_PUBLIC_SITE_URL` | Fallback base URL for sign-in and invite links |
| `SUPABASE_SECRET_KEY` | Supabase secret key, server only. In Vercel set it as type Secret; never prefix it with `NEXT_PUBLIC_` |
| `DEV_ACCOUNT_SWITCHER` | Local only. `on` enables the account switcher at `/dev/switch` under `npm run dev`. Never set it in Vercel |
| `RESEND_API_KEY` | Resend key for invite emails, server only, sending access to `mail.wolfpackindustries.club`. In Vercel set it as type Secret |

Keep `.env.local` out of git. The Supabase secret (service-role) key never goes in this repo; set it only in Vercel's environment variables when a feature needs it.

## Layout

- `src/proxy.ts`: refreshes the session on every request and sends signed-out visitors to `/login`
- `src/lib/supabase/server.ts`: Supabase client for server code, acting as the signed-in person
- `src/lib/supabase/admin.ts`: Supabase client with the secret key; skips row-level security, so it's used only for accepting invites and blocking sign-in
- `src/lib/members.ts`: `requireMember()` and `requireAdmin()` for pages and actions
- `src/lib/accounts.ts`: looks up an account and its membership by email (server only)
- `src/lib/email.ts`: sends email through Resend
- `src/lib/circles.ts`: circle types and form checks
- `src/app/members/`: member directory, invites and admin tools
- `src/app/circles/`: circles list, circle pages, and adding, removing and managing people
- `src/app/events/`: events and hikes: list, new, edit, event page with RSVPs and map
- `src/components/map-picker.tsx`, `map-view.tsx`: Leaflet maps with OpenStreetMap tiles (tap to drop a pin; read-only view)
- `src/components/place-field.tsx`, `place-search.ts`: place name with search-as-you-type (places used before, then Photon results) that drops the map pin
- `src/app/chat/`, `src/components/chat/chat-room.tsx`, `src/lib/chat.ts`: chat rooms (Everyone at /chat, plus one on each event and circle page), live through Supabase Realtime
- `src/lib/trails.ts`: WTA search links and trail link checks (WTA has no public API)
- `src/lib/time.ts`: event times are entered and shown in Pacific time, whatever the server's clock
- `src/app/invite/[token]/`: where an invite link lands; creates the account and signs the person in
- `src/app/no-access/`: shown to someone signed in without an active membership
- `src/app/dev/switch/`: local-only account switcher (see "Run it locally")
- `src/app/login/`: sign-in page and the server action that emails the link
- `src/app/auth/confirm/`: where the emailed sign-in link lands; signs in once the page opens, with a button as fallback
- `src/app/auth/callback/`: older code-exchange landing route, kept as a fallback
- `src/app/auth/signout/`: sign-out endpoint
