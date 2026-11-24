// The account switcher at /dev/switch signs you in as any member without an
// email, for testing on your own computer. It works only under `npm run dev`
// AND with DEV_ACCOUNT_SWITCHER=on in .env.local. Vercel builds run with
// NODE_ENV=production, so it can never be turned on for the live site.
export const devSwitcherEnabled =
  process.env.NODE_ENV === "development" && process.env.DEV_ACCOUNT_SWITCHER === "on";
