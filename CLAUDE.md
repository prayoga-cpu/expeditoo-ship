# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**EXPEDITOO** (`expeditoo-ship`) is the **driver-side app for Expedion demand** in
France. Expedion — the sibling quote product — escalates paid jobs no driver has
taken; approved drivers bid downward on price, ETA and vehicle; **an operator
selects** the winner. Status writes back so the Expedion client never leaves
their app. Revenue is a commission on each completed delivery.

**There are two inlets.** Expedion escalation, and a direct transport request
posted at `/create` by anyone with a session. The second was deleted in
`7a455c0` and restored on 2026-08-26 because the client asked for it back; if
you are reading an older doc that says "Expedion escalation is the only inlet",
that is what changed. **Won-checkout code and goods-auction concepts are still
leftovers** and should be removed, not extended — the only auction here is the
reverse auction on transport.

The two inlets differ in who awards the job, and that difference is load-bearing:
an escalated job is owned by the Expedion system account and awarded by an
**operator**; a direct request is owned by the person who posted it and awarded
by **them**. `offersService.acceptOffer` reads `listing.origin` to tell the two
apart, which is why `origin` is stamped by the service and is **not** a field on
`createListingSchema` — accepting it from the client would let anyone post work
straight into the operator award queue.

**Nobody signs in as the owner of an escalated job.** Those listings belong to a
system account (`EXPEDION_SYSTEM_USER_ID`) that no human logs into, which is why
awarding is an operator permission rather than an owner permission. (This is not
the same as saying nobody holds the `shipper` role — every signup does. See
§"Data Model".)

`ROADMAP.md` is the product source of truth. Read it before planning anything.

**Current status:** driver-side revamp complete; the Expedion inlet needs a real
payment signal. See §"Where Things Stand".

**Knowledge graph:** `graphify-out/graph.json` is a merged cross-repo graph
covering both this repo and the sibling `expedion_encheres` Flutter client —
node IDs carry a `repo` attribute so you can tell which side of the bridge a
result came from. Query it (`graphify query "<question>"`) before grepping for
architecture, cross-file, or cross-repo questions, especially anything about the
Expedion escalation bridge (`markPaid`, `escalateAfter`, `external_ref`,
`expedion_quotes`). Regenerate with `graphify <path> --update` after either
repo's docs or structure change meaningfully — it goes stale otherwise.

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
and never sees prices, offers or payouts. `shipper` is the **default role granted
to every new signup** (`assignDefaultRole`, `src/server/dal/users.dal.ts`) — a
leftover from the era when shippers posted work. No shipper-facing surface exists,
so the role reaches nothing in the UI, but do not read that as "nobody holds it":
`POST /api/listings` checks for a session and no role at all, so the job-posting
API is live for any signed-in user even though nothing links to it. The Expedion
system account is the owner of escalated listings, not the only holder of the
role. See `docs/specs/roles_spec.md` for the permission matrix.

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
438 unit tests pass · `pnpm build` succeeds.

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
- Expedion bridge: `POST /api/expedion/quotes/:id/paid` starts the escalation clock,
  and the Expedion payment server **does** call it — `api/confirm-payment.js` in
  `expedion_encheres` verifies the Checkout session with Stripe and posts here.
  Escalation is idempotent via `external_ref` and refuses to release its claim after
  creating a listing; status changes write back
- **Post-payment fork** at `/admin/expedion`: a paid quote reads "Needs a driver"
  and offers both lanes as buttons — assign from the pool, or publish to the
  marketplace — with the auto-publish deadline shown as the fallback it is. The
  price locks at payment (`PRICE_LOCKED`); the correction path is
  `POST /quotes/:id/requote`. Assignment goes through
  `expedionEscalationService.assignDirect`, which escalates and then awards the
  chosen driver through `offersService.acceptOffer`, so both lanes produce the
  same listing + offer + shipment + payment hold. A driver is never attached by
  patching `assignedCarrierId` — that route no longer accepts the field.
  `expedion_quotes.assigned_directly` is what keeps the escalation-rate KPI
  honest, since a pool assignment now mints a listing like an auction does.
  `docs/specs/expedion_post_payment_fork_spec.md`
- Crons: listing expiry, document expiry, escalation sweep, image cleanup — driven by
  `.github/workflows/scheduled-jobs.yml`, not Vercel Cron (Hobby caps crons at 2/project,
  once per day). Needs repo variable `APP_URL` and repo secret `CRON_SECRET`.
- Theme-aware loader (light/dark `.lottie` cuts, picked by `resolvedTheme`); one shared
  `BrandWordmark` lockup across sidebar, mobile header and marketing
- FR/EN parity exact, 1715 keys (verified by key diff, not by eye)
- **Carrier trips** at `/carrier/trips`: one screen, two tabs, as the client asked.
  *Prévus* is the new `carrier_routes` / `carrier_route_dates` pair — routes a
  carrier declares as recurring (weekdays) or occasional (specific dates),
  **private to them**, rendered as a saved query against the board's existing
  `nearLat`/`radiusKm`/`pickupFrom` filters, so there is no matching engine.
  *Effectués* reuses `GET /api/shipments` and joins `/api/carrier/earnings` for
  the money. Pulls `ROADMAP.md` §8 Phase D forward and makes the marketing
  claim about filtering on existing trips true. 44 tests.
  `docs/specs/carrier_trips_spec.md`
- **Billing documents**: `invoicesService.createFromPayment` was dead code —
  called from nowhere but its own test — so no invoice had ever been created.
  It now fires from `settleDelivery`, in its own try so paperwork cannot strand
  a captured payment. `/profile/invoices` was linked from nothing but an email
  body and is now in the profile quick links, with the Cocolis period filter and
  a bundle download. The carrier's half is a **relevé d'activité**, not a
  facture: while `COMMISSION_RATE` is 1.0 the net is €0 and the screen says so
  rather than inventing a split. `docs/specs/billing_documents_spec.md`

**Not done**
- **Real Stripe hold/capture** — runs under `MOCK_PAYMENTS`; needs SetupIntent
  confirmation and `amount_capturable_updated` webhook handling
- **Driver pay on either lane.** Escalation hands the driver the full
  `acceptedPriceCents` as the bid ceiling; direct assignment writes it as the
  offer price. The commission split (`ROADMAP.md` §10) is what decides how much
  of that is actually theirs, and it is still unnamed.
- **Commission split on Expedion-origin jobs is undecided** (`ROADMAP.md` §10).
  `budgetCents` is what the client already paid; the margin is whatever the driver
  bids below it. Payouts cannot go live until this is named.
- Payouts stop at `scheduled`. A carrier earnings *view* now exists at
  `/carrier/trips` → Effectués, but it reports €0 net because the platform
  retains 100% during testing — nothing moves money
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
