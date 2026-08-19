# Spec: Environment separation (local / preview / production)

## 1. Problem

`.env.local` was a raw `vercel env pull` dump: it carried the production
Supabase connection string and production third-party keys. `pnpm dev`,
`pnpm db:push`, `pnpm db:migrate`, and every script under `src/scripts/`
therefore read and wrote the production database, published to the production
Ably channels, and could send real email — on a laptop.

This spec defines three environments, how a process determines which one it
is, and the guards that make it structurally hard to point the wrong process
at production again.

## 2. Environments

| | `local` | `preview` | `production` |
|---|---|---|---|
| Runs on | a developer's machine | a Vercel Preview deployment (per-PR) | the Vercel Production deployment |
| Database | local PostgreSQL 17, or a registered dev Supabase project | a registered dev Supabase project | the production Supabase project |
| Stripe | test keys | test keys | live keys (asserted at boot) |
| Ably | shared key, channels namespaced `local:*` | shared key, channels namespaced `preview:*` | shared key, unprefixed channels |
| Email | redirected to `EMAIL_DEV_RECIPIENT` or dropped | redirected to `EMAIL_DEV_RECIPIENT` or dropped | sent for real |
| R2 buckets | `expeditoo-dev` / `expeditoo-kyc-dev` | same as local, or its own | `expeditoo` / production KYC bucket |
| `MOCK_PAYMENTS` | `true` | `true` | must be unset/`false` (boot fails otherwise) |

## 3. How a process knows which environment it is

`src/lib/env.ts` exports `APP_ENV: "local" | "preview" | "production"`,
resolved in this order:

1. `NEXT_PUBLIC_APP_ENV` — set by `next.config.mjs` at build time (see below),
   so server and browser code agree on the value even though `APP_ENV` and
   `VERCEL_ENV` are invisible in the browser.
2. `APP_ENV` — an explicit pin, for standalone scripts that never go through
   Next (`src/db/migrate.ts`, `src/scripts/*`, `scripts/guard-db.ts`).
3. Off Vercel (`VERCEL` unset): always `"local"`. A local `next build` still
   sets `NODE_ENV=production`, which is why nothing in this codebase should
   key environment-sensitive logic off `NODE_ENV` — it does not mean what it
   sounds like it means.
4. On Vercel: `VERCEL_ENV` (`production` / `preview` / anything else →
   `local`, matching Vercel's own "Development" scope).

`next.config.mjs` duplicates step 2–4's logic (it runs before webpack exists
to import a `.ts` file) to compute `NEXT_PUBLIC_APP_ENV` and inject it via the
`env` config key. If you change the resolution order, change both places.

`isProductionEnv` / `isPreviewEnv` / `isLocalEnv` are the derived booleans
most call sites want. `namespaced(name)` and `envTag()` prefix a shared
identifier (an Ably channel, mainly) with the environment tag outside
production.

## 4. Database guards

`src/lib/db-target.ts` is the single definition of "which database is this."
`describeDatabase(url)` parses a connection string and reports:

- `isProduction` — the URL's host or Supabase project ref matches
  `PRODUCTION_DB_REFS` (hardcoded, not read from env — a missing env var must
  never silently disable this).
- `isLocal` — host is `localhost` / `127.0.0.1` / `::1` / `0.0.0.0`.
- `isKnownDev` — `isLocal`, or the Supabase project ref is listed in the
  comma-separated `DEV_DB_REFS` environment variable.

Two assertions build on it, both fail-closed (an unrecognised remote host is
refused, not assumed safe):

- `assertNotProductionDatabase(url, action)` — throws only if the target is
  production. Used by `src/db/index.ts` on every server boot (`next dev` /
  `next start`), so the app itself cannot open a connection to production
  outside the production deployment.
- `assertDevelopmentDatabase(url, action)` — throws unless the target is
  `isKnownDev`. Stricter; used by anything destructive: `pnpm db:migrate`,
  `pnpm db:clean`, `pnpm db:push` / `db:studio` (via `scripts/guard-db.ts`),
  `pnpm db:mirror`'s restore leg, and `pnpm db:seed:dev-users`.

`src/lib/env-assertions.ts` (run once from `src/instrumentation.ts` at server
boot) checks the direction the two guards above cannot: that the **production**
deployment is actually pointed at the production database, not silently
running against an empty or wrong one.

To add a second development database (a Supabase project, so Preview deploys
and teammates share one): create the Supabase project, then add its ref to
`DEV_DB_REFS` in `.env.local` and in the Vercel Preview environment.

## 5. `pnpm db:mirror` — anonymised production → dev copy

```
pnpm db:mirror
```

1. Reads `MIRROR_SOURCE_URL` from `.env.local` — production's **direct**
   (port 5432) connection string. A different variable name than
   `POSTGRES_URL` on purpose: `POSTGRES_URL` must never be able to resolve to
   production by typo or copy-paste.
2. `pg_dump`s production, schema `public`, to a temp file. Read-only — no
   statement in this step can write to production.
3. Refuses to continue unless the target (`POSTGRES_URL` in `.env.local`, or
   `MIRROR_TARGET_URL`) passes `assertDevelopmentDatabase`.
4. Drops and recreates the target's `public` schema, restores the dump into
   it.
5. Runs `scripts/sql/anonymize.sql` — see §6.
6. Runs `scripts/sql/verify-anonymized.sql`, which throws (non-zero exit) if
   any row still carries something the scrub was supposed to remove. A
   half-scrubbed mirror cannot pass silently.

Requires `pg_dump`/`pg_restore` ≥ the production server's major version
(production runs PostgreSQL 17.x); `brew install postgresql@17` provides them.

## 6. What `anonymize.sql` keeps and destroys

See the file's own header for the exact column list. Summary:

**Kept** — row counts, ids, foreign keys, timestamps, statuses, money
amounts, listing titles/descriptions, listing photo URLs (already public),
city + coordinates rounded to ~1 km.

**Destroyed** — names, emails, phones, street addresses; KYC document
storage keys and proof-of-delivery photos (both point at real R2 objects);
every free-text field people wrote to each other; all session tokens,
password hashes, OAuth tokens; every live Stripe id (`payment_intent`,
`checkout_session`, `transfer`, `account`).

After mirroring, sign in locally with `pnpm db:seed:dev-users` — mirrored
password hashes are wiped, so the mirror alone has no working credentials.

## 7. Third-party services

- **Ably** (`src/lib/ably-server.ts`, `ably.service.ts`,
  `AblySubscriptions.tsx`, `useMessageDetail.ts`): channel names and token
  capability patterns all go through `namespaced()`. One API key is shared
  across environments; the namespace is what stops a local publish from
  reaching a production subscriber (or vice versa). All four call sites must
  stay in agreement — see the cross-references in their comments.
- **Email** (`src/lib/email.ts`): `sendViaResend()` is the only sanctioned way
  to call the Resend API. Outside production it rewrites the recipient to
  `EMAIL_DEV_RECIPIENT`, or drops (logs, does not send) the email when that is
  unset. Calling `resend.emails.send` directly bypasses this — don't.
- **R2**: bucket names are plain env vars (`R2_BUCKET_NAME`,
  `R2_KYC_BUCKET_NAME`), already read per-request rather than cached at import
  time in a shared module. Point them at separate dev buckets.
- **Stripe**: `src/lib/env-assertions.ts` throws at boot if production is
  missing a `sk_live_` key, or if a non-production environment holds one.

## 8. Vercel environment variables

Managed with the Vercel CLI, never by hand-editing `.env.local` into the
dashboard:

```bash
pnpm env:list                              # read-only: what's set, per scope
pnpm env:set STRIPE_SECRET_KEY production  # prompts for the value (hidden)
pnpm env:pull:production                   # → .env.production.local (reference only)
pnpm env:pull:preview                      # → .env.preview.local (reference only)
```

`env:pull:*` output files are for **reading**, to compare what's configured —
never rename one to `.env.local`. That is the exact mistake this spec exists
to undo.

## 9. Setting up a fresh machine

```bash
cp .env.example .env.local     # fill in test-mode keys; ask a teammate or check Vercel
pnpm db:start                  # local PostgreSQL 17, creates expeditoo_dev
pnpm db:migrate                # apply schema
pnpm db:mirror                 # OR: anonymised copy of production
pnpm db:seed:dev-users         # sign-in accounts (admin@dev.local etc., see the script)
pnpm dev
```
