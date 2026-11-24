# Wolfpack

A private, invite-only website for one group of friends (up to about 30 people) to plan hikes, parties and get-togethers, chat, and share photos and video. Secret spots such as fishing holes and mushroom patches stay visible only to the circles allowed to see them.

Built with Next.js 16 on Vercel, Supabase, Resend and Leaflet with OpenStreetMap tiles.

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

## Supabase settings

Set these in the Supabase dashboard:

- **Authentication → Sign In / Providers:** turn off "Allow new users to sign up". People join only through invites.
- **Authentication → URL Configuration:** set Site URL to `https://wolfpackindustries.club`, and add `http://localhost:3000/**` and `https://wolfpackindustries.club/**` to the redirect URLs.
- **Authentication → Users:** add yourself with "Add user" so you can sign in before the invite flow exists.

## Database

SQL lives in `supabase/`:

- `migrations/`: schema changes, applied in filename order. Paste each new one into the Supabase SQL editor and run it once.
- `tests/access_core_test.sql`: checks the access rules (who can see and change what). Safe to run on the live project at any time: it works inside one transaction and rolls everything back. A single row saying "All access tests passed" means every check passed; a failure stops with a message starting `FAIL:`.
- `bootstrap_admin.sql`: run once to make yourself the first admin. Fill in your name and email in the editor; don't commit them.

How access works: a sign-in account alone grants nothing. A person needs an active row in `members`. Shared content is visible to Everyone (`circle_id` is null) or to one circle, checked by `public.can_see(circle_id)`. Secret circles are invisible to non-members, and admins can manage a secret circle's membership without seeing its content.

## Environment variables

| Name | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (safe in the browser; data is protected by row-level security) |
| `NEXT_PUBLIC_SITE_URL` | Fallback base URL for sign-in and invite links |
| `SUPABASE_SECRET_KEY` | Supabase secret key, server only. In Vercel set it as type Secret; never prefix it with `NEXT_PUBLIC_` |

Keep `.env.local` out of git. The Supabase secret (service-role) key never goes in this repo; set it only in Vercel's environment variables when a feature needs it.

## Layout

- `src/proxy.ts`: refreshes the session on every request and sends signed-out visitors to `/login`
- `src/lib/supabase/server.ts`: Supabase client for server code, acting as the signed-in person
- `src/lib/supabase/admin.ts`: Supabase client with the secret key; skips row-level security, so it's used only for accepting invites and blocking sign-in
- `src/lib/members.ts`: `requireMember()` and `requireAdmin()` for pages and actions
- `src/app/members/`: member directory, invites and admin tools
- `src/app/invite/[token]/`: where an invite link lands; creates the account and signs the person in
- `src/app/no-access/`: shown to someone signed in without an active membership
- `src/app/login/`: sign-in page and the server action that emails the link
- `src/app/auth/callback/`: where the emailed link lands
- `src/app/auth/signout/`: sign-out endpoint
