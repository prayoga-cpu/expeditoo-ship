# Plan — move production to www.expeditop.fr (2.90.1)

Spec: `docs/specs/domain_expeditop_fr_spec.md`.

## Starting point (2026-11-20)

- The client bought **expeditop.fr** (DNS on Cloudflare). The **expeditoo.fr**
  and **expeditoo.com** that this repo's code and copy named belong to someone
  else (OVH) — they were never ours.
- In Vercel (project `expeditoo-ship`, team Epidom) `www.expeditop.fr` is the
  production domain; `expeditop.fr` and `expeditop.com`/`www.expeditop.com`
  308 to it; `expeditoo-ship-five.vercel.app` 307s to it.

## Steps

1. One module owns the origin: `src/lib/app-url.ts` (`appUrl()`,
   `PRODUCTION_ORIGIN`, `mailbox()`), replacing fifteen pasted
   `process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"` fallbacks.
2. Rename every mailbox and the site name in copy, FR and EN
   (`messages/*.json`, contact page, help pages, marketing footer).
3. Point tooling at the new host: `scripts/auth-preflight.mjs` default,
   route-planner `User-Agent`, `.env.example`, cron workflow comment.
4. Production configuration: Vercel `NEXT_PUBLIC_APP_URL`, GitHub `APP_URL`.
5. Release 2.90.1 in the four places.

## Not in this change (needs the owner or another repo)

Listed in the spec §5 and in STATUS → Operator to-do: Google OAuth redirect
URI, Stripe webhook and Apple Pay domain, Resend sender, mailboxes, the Expedion
payment server and Flutter app's base URL.

## Dependencies

None between code and migration: no schema change.
