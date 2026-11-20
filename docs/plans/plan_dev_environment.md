# Plan: a dev environment at `dev.expeditop.fr`

Status: proposed, 2026-11-20. Nothing in this plan has been applied yet.
Contract it extends: `docs/specs/environments_spec.md` (which still says
Supabase in places and is corrected in step C6).

## 1. Goal

A long-lived deployment at `https://dev.expeditop.fr`, built from a `dev`
branch, that shares **nothing writable** with production: its own database,
buckets, Stripe mode, auth secret and cron secret. A schema change, a seed
script or a debugging session there cannot reach a production row, object or
card.

## 2. Where things stand (checked 2026-11-20)

The code is already built for three environments (`local` / `preview` /
`production`, `src/lib/env.ts`) and has fail-closed database guards
(`src/lib/db-target.ts`). What is missing is the middle environment itself.

| Fact | Consequence |
|---|---|
| GitHub has `main` and `release/*` only | no branch for a dev deployment to track |
| Vercel `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` are one value for Production **and** Preview (Neon integration) | every preview deployment is handed the production database. `src/db/index.ts` refuses it at boot, so previews crash instead of writing — safe, but no preview works |
| `R2_BUCKET_NAME` is one value for Production and Preview | **the dangerous one.** `cleanup-images` deletes every object in that bucket it cannot match to a listing photo. Run it on a deployment with a different database and it empties the production image bucket |
| `BETTER_AUTH_SECRET` is shared | a session cookie minted on a preview is valid in production |
| `NEXT_PUBLIC_APP_URL` is shared | links in preview emails and Stripe returns point at production |
| `EXPEDION_API_KEY` / `EXPEDION_ADMIN_API_KEY` are shared | a client pointed at the wrong host is still authorised |
| Preview has no `DEV_DB_REFS`, `EMAIL_DEV_RECIPIENT`, `CRON_SECRET`, `MOCK_PAYMENTS` | migrations refuse a remote dev database; mail is dropped; crons cannot authenticate |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `R2_EXPEDION_BUCKET_NAME`, `EXPEDION_*_ID` already differ per scope | nothing to do, beyond confirming the preview Stripe key is `sk_test_` (boot asserts it) |
| Vercel protection is `all_except_custom_domains` | `dev.expeditop.fr` will be public, which Stripe webhooks and the Expedion app need — so it must not be indexed (step C4) |
| `migrate.yml` offers `production` only; `gates.yml` runs on `main` and PRs | no way to migrate a remote dev database; pushes to `dev` are unchecked |
| Vercel CLI on this laptop is logged out | step D1 |

## 3. What epidom does, and what to take from it

| Epidom | Take it? |
|---|---|
| `dev` branch, production on `main`; `dev.epidom.fr` is a domain bound to that git branch in the **Preview** scope | **Yes, as is.** No custom environment: `VERCEL_ENV=preview` maps onto the `preview` this code already understands, so no code learns a fourth environment |
| Neon `dev` branch, child of `main`; Preview-scoped `DATABASE_URL` points at it | **Yes**, with the two changes below |
| Nightly `reset_to_parent` (raw production data copied into dev) | **No.** Expeditop holds KYC file keys, 4,592 quote owners, password hashes and live Stripe ids. Use the existing anonymising mirror (`pnpm db:mirror`) from a workflow instead, on demand rather than nightly |
| `prisma migrate deploy` inside the Vercel build | **Yes for `dev` only.** Production stays a deliberate `workflow_dispatch` (`migrate.yml`), because migrations here are hand-written |
| CI on `push: [main, dev]` | **Yes** |
| `ops-env-audit.yml` (keys in `.env.example` missing from Vercel) | **Yes**, extended to check each scope — the table in §2 is exactly the drift it would have caught |
| `docs/OPERATIONS.md` secrets inventory | Folded into `environments_spec.md` §8 rather than a new doc |

## 4. Decisions

1. **Preview scope + branch domain, not a Vercel custom environment.** The
   team has one custom-environment slot and the code has three environments;
   using Preview costs neither.
2. **Preview-wide values for everything isolating** (database, buckets,
   secrets, Stripe test keys), so a PR preview is as safe as `dev`. Only
   `NEXT_PUBLIC_APP_URL` is set for the `dev` branch specifically.
3. **Dev database = a Neon branch named `dev` in the existing project**,
   filled by the anonymised mirror. Its role password is reset after creation:
   a Neon branch inherits the parent's role passwords, so until then the dev
   connection string differs from production's only by hostname.
4. **`MOCK_PAYMENTS` off on dev, Stripe test mode on.** The real charge path
   has never run in production; dev is where it gets exercised with test cards
   and a real test-mode webhook. (This departs from the spec's table, which
   says `true` for preview; C6 updates it.)
5. **Crons on dev are manual.** `scheduled-jobs.yml` gains a `target` input for
   `workflow_dispatch`; the schedule keeps hitting production only.

## 5. Steps

### A. Owner, in dashboards (cannot be done from the repo)

- A1. **Neon**: create branch `dev` from `main`; reset the owner role's
  password **on that branch**; note its endpoint id (`ep-…`) and its pooled
  and direct URLs.
- A2. **Cloudflare R2**: create `expeditop-dev`, `expeditop-kyc-dev`,
  `expeditop-shipments-dev` (the Expedion dev bucket already exists per scope).
  Ideally a second API token scoped to the dev buckets only.
- A3. **Cloudflare DNS**: `dev` CNAME → `cname.vercel-dns.com`, DNS only.
- A4. **Stripe (test mode)**: webhook endpoint
  `https://dev.expeditop.fr/api/stripe/webhook`; copy its `whsec_`.
- A5. **Google Cloud**: add `https://dev.expeditop.fr/api/auth/callback/google`
  to the OAuth client's redirect URIs and the origin to authorised origins.
- A6. **Vercel → Storage → Neon connection**: untick **Preview**, so the
  integration stops injecting production's URL into that scope (an
  integration-managed variable cannot be overridden in place).

### B. GitHub

- B1. Create `dev` from the tip of `main` and push it. `main` stays the
  default and the Vercel production branch.
- B2. Protect `main`: PR required, `Gates` required. (`dev` stays pushable.)
- B3. Secrets: `POSTGRES_URL_DEV` (direct URL from A1), `CRON_SECRET_DEV`,
  `MIRROR_SOURCE_URL` (the `mirror_readonly` URL already in `.env.local`).
  Variables: `APP_URL_DEV=https://dev.expeditop.fr`, `DEV_DB_REFS=<ep-id>`.

### C. Codebase (one release)

- C1. `gates.yml`: `push.branches: [main, dev]`.
- C2. `migrate.yml`: add `dev` to the `environment` choice. On `dev` it uses
  `POSTGRES_URL_DEV` + `DEV_DB_REFS` and **does not** set `MIGRATE_TARGET`, so
  `assertDevelopmentDatabase` still applies and a production URL pasted into
  the dev secret is refused.
- C3. `scripts/vercel-build.sh` as the Vercel build command: when
  `VERCEL_ENV=preview` and `VERCEL_GIT_COMMIT_REF=dev`, run `pnpm db:migrate`
  (retrying while the Neon compute wakes, as epidom's `migrate-deploy.mjs`
  does), then `next build`. Any other deployment is a plain `next build`, so
  production's behaviour is unchanged.
- C4. Non-production deployments send `X-Robots-Tag: noindex, nofollow`
  (`next.config.mjs`, keyed on the `NEXT_PUBLIC_APP_ENV` it already computes),
  and the shell shows a small « DEV » marker so nobody mistakes the two tabs.
- C5. `refresh-dev-db.yml` (`workflow_dispatch`, typed confirmation): runs
  `scripts/db-mirror.sh` with `MIRROR_TARGET_URL=POSTGRES_URL_DEV`, then
  `pnpm db:migrate` for migrations not yet on production, then
  `pnpm db:seed:dev-users`. `scheduled-jobs.yml` gains
  `target: production | dev` on manual runs. `env-audit.yml` compares
  `.env.example` with each Vercel scope.
- C6. Docs and scripts: `environments_spec.md` (Neon not Supabase, the dev
  column, decision 4, the promotion flow in §6 below), `.env.example`,
  `package.json` (`env:pull:dev`, `env:set` accepting a git branch),
  `CLAUDE.md` §"Essential Commands", and a test for the build script's branch
  condition. Release recorded per `AGENTS.md` §8.

### D. Vercel CLI

```bash
# D1. sign in and link (once)
vercel login
vercel link --yes --project expeditoo-ship --scope epidom

# D2. stop sharing: remove the Preview half of each shared variable.
#     For a variable stored as one row for both scopes this is an edit in the
#     dashboard (untick Preview), or: rm, then re-add for production.
#     POSTGRES_* go away with A6.

# D3. Preview-wide values (each prompts for the value, hidden)
for k in POSTGRES_URL POSTGRES_URL_NON_POOLING DEV_DB_REFS BETTER_AUTH_SECRET \
         CRON_SECRET R2_BUCKET_NAME R2_KYC_BUCKET_NAME R2_SHIPMENT_BUCKET_NAME \
         R2_PUBLIC_URL EXPEDION_API_KEY EXPEDION_ADMIN_API_KEY \
         EMAIL_DEV_RECIPIENT STRIPE_WEBHOOK_SECRET; do
  vercel env add "$k" preview
done

# D4. dev-branch-only value
vercel env add NEXT_PUBLIC_APP_URL preview dev   # https://dev.expeditop.fr

# D5. domain, bound to the dev branch
vercel domains add dev.expeditop.fr expeditoo-ship
#     then Project → Domains → dev.expeditop.fr → Environment: Preview,
#     Git branch: dev (the CLI adds a domain but cannot bind it to a branch;
#     the Vercel API / MCP can).

# D6. check
vercel env ls preview
vercel env pull .env.preview.local --environment=preview --git-branch=dev
git push origin dev          # first deployment; migrates, then builds
vercel inspect dev.expeditop.fr
```

Values to generate fresh: `BETTER_AUTH_SECRET` and `CRON_SECRET`
(`openssl rand -hex 32`), both Expedion keys. `R2_PUBLIC_URL` on dev is
`https://dev.expeditop.fr/api/images`.

## 6. Day-to-day flow once it exists

```
feature branch ──PR──▶ dev ──auto──▶ dev.expeditop.fr   (dev DB migrated in the build)
                        │
                        └──PR (Gates)──▶ main
                                          1. Actions → Migrate database → production
                                          2. merge → www.expeditop.fr
```

Local work is unchanged: `.env.local` → local PostgreSQL, `pnpm db:mirror`
for realistic data.

## 7. Order, and what must not be skipped

A6 and D2/D3 for `R2_BUCKET_NAME` come **before** the first cron is ever
pointed at dev — that is the one step where a mistake deletes production
data. Everything else fails closed: a wrong database URL crashes the boot, a
live Stripe key crashes the boot, an unlisted database refuses the migration.

## 8. Verification

- `dev.expeditop.fr` boots (a production database URL or a live Stripe key
  would have crashed it); Admin → Paramètres → « Paiements Stripe » reports
  **test** key modes.
- Sign up on dev, then confirm with the read-only mirror role that the
  account does not exist in production.
- A dev session cookie replayed against `www.expeditop.fr` is rejected.
- Accept an offer with `4242…` and with a 3-D Secure test card; the test-mode
  webhook is delivered.
- Upload a listing photo on dev; it lands in `expeditop-dev`.
- Run `cleanup-images` on dev with `dryRun=true` first and read the count.
- `curl -I https://dev.expeditop.fr` carries `X-Robots-Tag: noindex`.
- `migrate.yml` on `dev` with a production URL in the secret is refused.

## 9. Not in scope

Per-PR Neon branches, a dev instance of the Expedion Flutter app, Twilio on
dev (unset: sends are skipped and logged), and Vercel custom environments.
