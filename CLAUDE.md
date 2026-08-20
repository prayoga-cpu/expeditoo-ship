# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**EXPEDITOO** (`expeditoo-ship`) is the **driver-side app for Expedion demand** in
France. Expedion — the sibling quote product — escalates paid jobs no driver has
taken; approved drivers bid downward on price, ETA and vehicle; **an operator
selects** the winner. Status writes back so the Expedion client never leaves
their app. Revenue is a commission on each completed delivery.

**Shippers do not post jobs here.** Expedion escalation is the only inlet. If you
find a job-posting form, a shipper's "my jobs" list, or won-checkout code, it is
a leftover and should be removed, not extended. Likewise **there are no goods
auctions** — the only auction is the reverse auction on transport.

**Nobody signs in as the shipper.** Escalated listings are owned by a system
account (`EXPEDION_SYSTEM_USER_ID`), which is why awarding is an operator
permission rather than an owner permission.

`ROADMAP.md` is the product source of truth. Read it before planning anything.

**Current status:** driver-side revamp complete; the Expedion inlet needs a real
payment signal. See §"Where Things Stand".

---

## Essential Commands

```bash
pnpm dev            # Dev server (localhost:3000)
pnpm build          # Production build
pnpm lint           # ESLint
pnpm test           # Unit tests (Vitest)
pnpm test:e2e       # E2E tests (Playwright)
npx tsc --noEmit    # Typecheck — the gate that matters during the pivot

pnpm db:generate    # Generate Drizzle migration from schema
pnpm db:migrate     # Apply migrations
pnpm db:studio      # Drizzle Studio
```

---

## Core Flow

```
Expedion client accepts a quote and pays
   ↓  POST /api/expedion/quotes/:id/paid sets escalateAfter (+48h)
No driver assigned inside the window
   ↓  cron sweep auto-escalates
Quote becomes a listing (origin='expedion', externalRef=quote id)
   ↓  appears on /expedion
Approved drivers submit offers
   ↓  price + ETA + vehicle + message
An operator compares and accepts one
   ↓  Stripe authorised (held, not captured), shipment created
   ↓  status writes back to Expedion
Pickup → In transit → Delivered
   ↓  payment captured
Payout to driver, two-way review
```

---

## Data Model

| Entity | Meaning |
|---|---|
| `listings` | **A transport job**, not an item for sale |
| `offers` | A carrier's competing bid on a job |
| `shipments` | The execution record, created when an offer is accepted |
| `carriers` / `vehicles` / `carrier_documents` | **An individual driver's** profile, vehicle and KYC file |
| `payments` / `payouts` | Money in (held then captured) and money out |
| `user_roles` | Many-to-many; seven roles |

`listings.origin` (`direct` \| `expedion`) and `listings.external_ref` are the
bridge to the sibling Expedion product. Both legs are wired: escalation creates a
listing, and shipment status writes back so the Expedion client sees progress.
`external_ref` holds the quote id and is the **idempotency key** that stops a
retried escalation minting a second listing.

New listings are always `expedion`. `direct` survives only as the default on
legacy rows, and `/expedion` filters them out.

**The `carriers` table is person-level.** Applicants are individual drivers, not
haulage companies, so KBIS is not required — an auto-entrepreneur has none.
SIRET still is: a sole trader carrying goods for hire in France has one, and the
column is `NOT NULL`. One vehicle is required because an offer names the vehicle
that will do the job; that is not fleet management.

**Roles (7):** `shipper`, `carrier`, `driver`, `operator`, `support`, `finance`,
`admin`. The canonical list is `userRoleEnum` in `src/db/schema/users.ts` — Zod
schemas must **derive** from it, never restate it. A `driver` executes shipments
and never sees prices, offers or payouts. `shipper` is now held only by the
Expedion system account. See `docs/specs/roles_spec.md` for the permission matrix.

---

## Architecture (STRICT)

```
UI → Hooks → Client API → REST API → Service → DAL → Database
```

- UI never calls a Service or the DAL.
- API routes never call the DAL directly — always through a Service.
- **Services enforce permissions.** Routes resolve the session and pass it down;
  the DAL is permission-blind. Never inline a role check in a route handler.
- Zod at every boundary. No `any`. Functions under 50 lines.
- Errors: services throw typed error classes carrying a `code` and `status`;
  routes translate them via `src/lib/api-response.ts`.

Full rules in `docs/rules.md` — non-negotiable.

---

## Spec-Driven Development (MANDATORY)

1. Read `ROADMAP.md` for what to build.
2. Write `docs/plans/plan_<feature>.md` — steps, files, dependencies.
3. Write `docs/specs/<feature>_spec.md` — exact behaviour, edge cases,
   validation, error codes.
4. Implement to the spec. No improvisation.
5. Verify against the spec, including its "test coverage required" section.

Specs are the contract used to debug later. They are not optional.

---

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 + shadcn/ui ·
Drizzle + PostgreSQL · Better Auth · Ably (realtime) · Stripe Checkout + Connect ·
Cloudflare R2 + Sharp · Resend + React Email · MapLibre/OSM/Nominatim/OSRM ·
next-intl (FR + EN) · next-pwa + Capacitor (Android) · Vitest + Playwright.

---

## Design System

`ROADMAP.md` §7 is canonical. Source of truth for colour is `oklch` in
`globals.css`; the hex table exists so Flutter can match.

- Fonts: Plus Jakarta Sans (UI), Geist Mono (code/numerals)
- `radius` base `0.5rem`; card padding 16–20px; section gap 24px
- Empty states go through `centered-empty-state.tsx`, never ad-hoc
- Page transitions go through `page-wrapper.tsx` / `page-loader.tsx`
- **Light and dark are both mandatory** for every new surface

---

## Where Things Stand

The driver-side revamp is complete: the shipper surface is gone, Expedion is the
only inlet, and an operator awards in the client's place. Tracked in
`docs/plans/plan_phase_a_bidding_core.md` and
`docs/plans/plan_transport_only_refinement.md` (both partly superseded by the
revamp above).

**The repo is in user-testing mode.** Every MVP journey walks end to end through the
UI, but payments run behind `MOCK_PAYMENTS` and the Expedion escalation demo runs off
a seed script — read `docs/TESTING_MOCKS.md` before trusting anything money-shaped.
Every mock carries a `TODO(EXPEDITOO-TESTING)` marker; `grep -rn` it before shipping.

**Gates — all green.** `npx tsc --noEmit` 0 errors · `pnpm lint` 0 errors ·
168 unit tests pass · `pnpm build` succeeds.

**Done**
- Schema remodelled to the transport model; one clean initial migration
- Goods-auction surface deleted, including its checkout, browse card and categories
- **Shipper surface deleted**: job form, `create/success`, my-jobs list. `/listings/me`
  redirects to `/expedion`
- **`/expedion` job board**, pinned to `origin='expedion'` (filter threaded DTO → DAL → client)
- **`/home` is the driver dashboard**: application status, current run, open jobs,
  bids awaiting decision
- **Operator award queue** at `/admin/awards`; `offersService.acceptOffer` accepts an
  operator or admin on Expedion-origin jobs, and bills `listing.shipperId` rather than
  the actor. 35 tests
- Offers engine: atomic accept, concurrency guarantee, idempotency, Stripe compensation
- Listings as transport jobs: DTO, DAL, service, routes. 25 tests
- Driver KYC (person-level): application, private document storage, vehicle, admin
  approve/reject/suspend, expiry cron. 26 tests
- Payments: held on acceptance, captured on delivery, released on cancellation,
  commission at source, payout recorded
- Driver UI: shipment list and detail, status transitions, proof-of-delivery upload
- Admin UI: driver application review, award queue, Expedion bridge monitor — the
  last two were previously orphaned and are now in the sidebar
- **Admin user management** at `/admin/users`: last-login column, working "view
  profile", impersonation ("log in as", 60 min, audited in `impersonation_sessions`,
  banner while active), password reset, sign-out-everywhere, account delete.
  `docs/specs/admin_user_management_spec.md`. **A borrowed session never writes
  by itself** — every mutation that fired from a page load (message read
  receipts, `mark-seen`, Stripe customer/SetupIntent/Connect provisioning) is
  suppressed for it via `isImpersonated()`; add a new auto-firing write and you
  must guard it too. **Suspension now bites** — `user.banned`
  was written and read by nobody: it blocks session creation, kills live sessions, and
  `session.cookieCache.maxAge` dropped 7 days → 5 min so revocations are not invisible
  for a week
- Expedion bridge: `POST /api/expedion/quotes/:id/paid` starts the escalation clock;
  escalation is idempotent via `external_ref` and refuses to release its claim after
  creating a listing; status changes write back
- Crons: listing expiry, document expiry, escalation sweep, image cleanup — driven by
  `.github/workflows/scheduled-jobs.yml`, not Vercel Cron (Hobby caps crons at 2/project,
  once per day). Needs repo variable `APP_URL` and repo secret `CRON_SECRET`.
- Theme-aware loader (light/dark `.lottie` cuts, picked by `resolvedTheme`); one shared
  `BrandWordmark` lockup across sidebar, mobile header and marketing
- FR/EN parity exact, 1433 keys (verified by key diff, not by eye)

**Not done**
- **Real Stripe hold/capture** — runs under `MOCK_PAYMENTS`; needs SetupIntent
  confirmation and `amount_capturable_updated` webhook handling
- **Expedion never calls `/quotes/:id/paid`.** The endpoint exists and `markPaid`
  works, but nothing on the Expedion side posts to it yet, so `escalateAfter` is
  still only set by hand. Until that call is wired, auto-escalation stays inert on
  real data and only admin force-escalation works.
- **Commission split on Expedion-origin jobs is undecided** (`ROADMAP.md` §10).
  `budgetCents` is what the client already paid; the margin is whatever the driver
  bids below it. Payouts cannot go live until this is named.
- Payouts stop at `scheduled`; no driver earnings screen
- Realtime shipment data: the Ably path exists on both ends but is not connected
- `seller`/`buyer` vocabulary still in ~50 files (live paths fixed; the rest cosmetic)
- Marketing copy still describes a two-sided marketplace and oversells (J+7 payout,
  live bid refresh, 24 h verification)
- E2E proving the exit criteria end to end

## Gotchas

1. **No goods-auction concepts.** No `bids` on items, no `orders`, no `sellers`
   or `buyers`. And no shipper-facing surface at all — Expedion is the inlet.
2. A listing is a *job*. `budgetCents` is what the Expedion client already paid,
   **not a cap** — it is the ceiling the platform's margin comes out of.
3. Lowest price never wins automatically. An **operator** chooses.
4. Money is **held** on acceptance and captured on delivery. Never capture early.
   The payer is `listing.shipperId`, never whoever clicked accept.
5. KYC documents are private. Never serve them by direct URL, and never persist
   a full IBAN — only the last 4.
6. No feature flags, no backwards-compatibility shims. Make changes directly.
7. Docs under `docs/specs/` and `docs/plans/` written for the v1 goods
   marketplace are stale. The Phase A specs listed above are current.
8. **Never restate the role enum.** Derive from `userRoleEnum`. A restated copy
   in `user.dto.ts` silently broke every admin role assignment.
9. `.prettierc` is misnamed (missing an `r`), so Prettier never loads it and
   falls back to `trailingComma: "all"`. Running Prettier reformats whole files.
   Match surrounding style by hand instead.
