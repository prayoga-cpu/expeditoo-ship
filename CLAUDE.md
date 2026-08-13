# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**EXPEDITOO** (`expeditoo-ship`) is a **reverse-bidding transport marketplace** for
France. Shippers post transport jobs; carriers bid downward on price, ETA and
vehicle; **the shipper selects** the carrier. Stripe holds and releases payment.
Revenue is a 10% commission on each completed delivery.

**There are no goods auctions.** The only auction is the reverse auction on
transport. If you find auction, bid-on-item, or won-checkout code, it is a
leftover from v1 and should be removed, not extended.

`ROADMAP.md` is the product source of truth. Read it before planning anything.

**Current status:** Phase A functionally complete, Phase B wired. See §"Where Things Stand".

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
Shipper posts a job (listing)
   ↓  what / where / when / budget
Job goes live on the marketplace
Carriers submit offers
   ↓  price + ETA + vehicle + message
Shipper compares and accepts one
   ↓  Stripe authorised (held, not captured), shipment created
Pickup → In transit → Delivered
   ↓  payment captured
Payout to carrier, two-way review
```

---

## Data Model

| Entity | Meaning |
|---|---|
| `listings` | **A transport job**, not an item for sale |
| `offers` | A carrier's competing bid on a job |
| `shipments` | The execution record, created when an offer is accepted |
| `carriers` / `vehicles` / `carrier_documents` | Carrier company, its fleet, its KYC file |
| `payments` / `payouts` | Money in (held then captured) and money out |
| `user_roles` | Many-to-many; seven roles |

`listings.origin` (`direct` \| `expedion`) and `listings.external_ref` are the
bridge to the sibling Expedion product. Both legs are wired: escalation creates a
listing, and shipment status writes back so the Expedion client sees progress.

**Roles (7):** `shipper`, `carrier`, `driver`, `operator`, `support`, `finance`,
`admin`. A `driver` executes shipments and never sees prices, offers or payouts.
See `docs/specs/roles_spec.md` for the full permission matrix.

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

Phase A is functionally complete. Phase B (Expedion bridge) is wired both ways.
Tracked in `docs/plans/plan_phase_a_bidding_core.md` and
`docs/plans/plan_transport_only_refinement.md`.

**Gates — all green.** `npx tsc --noEmit` 0 errors · `pnpm lint` 0 errors ·
117 unit tests pass · `pnpm build` succeeds (104 pages).

**Done**
- Schema remodelled to the transport model; one clean initial migration
- Goods-auction surface deleted, including its checkout, browse card and categories
- Offers engine: DTO, DAL, service, routes — atomic accept, concurrency guarantee,
  idempotency, Stripe compensation. 30 tests
- Listings as transport jobs: DTO, DAL, service, routes. 25 tests
- Carrier/driver KYC: application, private document storage, fleet, admin
  approve/reject/suspend, expiry cron. 26 tests
- Payments: held on acceptance, captured on delivery, released on cancellation,
  10% commission at source, payout recorded
- Shipper UI: four-step job form, job detail with offer comparison and accept
- Driver UI: bid form, my offers, job board with filters
- Expedion bridge: inbound escalation creates a listing; status changes write back
- Crons: listing expiry, document expiry, escalation sweep — declared in `vercel.json`
- FR/EN parity exact (verified by key diff, not by eye)

**Not done** — see `plan_transport_only_refinement.md` WP11–WP16
- Driver onboarding + fleet **screens** (service and REST layer are done)
- Admin carrier review screens
- `seller`/`buyer` vocabulary still in ~70 files
- Marketing copy still describes a marketplace
- E2E proving the exit criteria end to end

## Gotchas

1. **No goods-auction concepts.** No `bids` on items, no `orders`, no `sellers`
   or `buyers` — it is `shipper` and `carrier`.
2. A listing is a *job*. `budgetCents` is the shipper's expectation, **not a cap** —
   carriers may bid above it and often will.
3. Lowest price never wins automatically. The shipper chooses.
4. Money is **held** on acceptance and captured on delivery. Never capture early.
5. KYC documents are private. Never serve them by direct URL, and never persist
   a full IBAN — only the last 4.
6. No feature flags, no backwards-compatibility shims. Make changes directly.
7. Docs under `docs/specs/` and `docs/plans/` written for the v1 goods
   marketplace are stale. The Phase A specs listed above are current.
