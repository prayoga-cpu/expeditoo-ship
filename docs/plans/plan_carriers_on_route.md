# Implementation Plan: Transporteurs disponibles sur le trajet

**Spec:** `docs/specs/carriers_on_route_spec.md`
**Date:** 2026-09-05

## Overview

Give the owner of a transport job — and an operator standing in for the Expedion
client — a tab on `/listing/[id]` listing the approved carriers whose declared
trajet covers that job inside its pickup window, each contactable in one tap.

Almost all of the raw material exists. `carrier_routes` stores declared trajets;
`src/lib/route-corridor.ts` already answers "is this job on that path, the right
way round"; `src/lib/carrier-route-matching.ts` already resolves recurring and
occasional runs; `messagesService.sendMessage` already opens a thread and fans
out on Ably. What is missing is a read that crosses carriers, a consent flag, a
projection safe to hand a stranger, and the surface.

## Prerequisites

- Read `docs/specs/carriers_on_route_spec.md`. It is the contract; §3 (the
  predicate), §4.3 (the projection) and §8 (non-goals) are not negotiable at
  implementation time.
- `docs/rules.md` — UI → Hooks → Client API → REST → Service → DAL → DB, Zod at
  every boundary, no `any`, functions under 50 lines.
- **Do not run Prettier.** `.prettierc` is misnamed so it never loads, and the
  fallback reformats whole files. `JobDetail.tsx` is the likeliest casualty.

## Implementation Steps

### 1. Schema, migration and journal

**Files to Create:** `src/db/migrations/0019_carrier_route_discoverable.sql`
**Files to Modify:** `src/db/migrations/meta/_journal.json`, `src/db/schema/carrier-routes.ts`

Add `is_discoverable boolean NOT NULL DEFAULT true`, backfill existing rows to
`false` (spec §4.2), index `(is_discoverable, is_active)`. Journal entry
`idx: 18`, `when: 1788098400000`, tag `0019_carrier_route_discoverable`.
Rewrite the schema header comment asserting absolute privacy, and correct
`radius_km`'s stale "off the origin" wording to corridor half-width.

### 2. The pure predicate

**Files to Create:** `src/lib/route-match.ts`, `src/lib/__tests__/route-match.test.ts`

`matchRoute(route, job, now?) → { detourKm, runs } | null`, composing
`corridorPath` / `isOnPath` / `positionOnPath` / `upcomingOccurrences`. Pure and
dependency-free. **No third copy of the corridor formula** and no change to
either helper it composes.

### 3. DTO → DAL → Service → Routes

**Files to Create:** `src/server/dto/carrier-discovery.dto.ts`,
`src/server/services/carrier-discovery.service.ts`,
`src/app/api/listings/[id]/carriers/route.ts`,
`src/app/api/listings/[id]/carriers/[matchId]/contact/route.ts`
**Files to Modify:** `src/server/dal/carrier-routes.dal.ts`, `src/lib/api-response.ts`

The DAL gains `findMatchCandidates` — the file's first read not scoped to one
carrier. It stays permission-blind; the gate lives in the service. Register
`CarrierDiscoveryError` in `handleError`.

### 4. Client API → Hook → UI

**Files to Create:** `src/features/app/listing/api/carriers.api.ts`,
`src/features/app/listing/hooks/useListingCarriers.ts`,
`src/features/app/listing/ui/CarrierMatchCard.tsx`,
`src/features/app/listing/ui/AvailableCarriersPanel.tsx`
**Files to Modify:** `src/features/app/listing/api/index.ts`,
`src/features/app/listing/ui/index.ts`,
`src/features/app/listing/hooks/useJobDetail.ts` (extend `jobKeys`),
`src/features/app/listing/ui/JobDetail.tsx`,
`src/app/(app)/(main)/listing/[id]/page.tsx`

`JobDetail` gains the URL-held tab strip and is translated in the same pass
(spec §5.4). `page.tsx` gains the `Suspense` boundary `useSearchParams` requires.

### 5. Carrier-side consent

**Files to Modify:** `src/server/dto/carrier-routes.dto.ts`,
`src/server/services/carrier-routes.service.ts`,
`src/features/app/carrier/api/trips.api.ts`,
`src/features/app/carrier/ui/TripRouteFormDialog.tsx`,
`src/features/app/carrier/ui/TripRouteCard.tsx`

A switch in the trip dialog, a badge on the card. The dialog's description loses
« Vous seul le voyez » — leaving it would make the product lie to its drivers.

### 6. i18n

**Files to Modify:** `messages/fr.json`, `messages/en.json`

`myJobs.detail.*` and `myJobs.carriers.*`; corrected `carrier.trips.form.*`.
Identical key paths in both catalogues, no empty strings — `locale-parity.test.ts`
walks every leaf.

### 7. Documentation

**Files to Modify:** `docs/specs/carrier_trips_spec.md`, `CLAUDE.md`

Amend §1, §5, §9 and §10 of the trips spec: a trajet is private *unless* the
carrier makes it discoverable. Record the feature in CLAUDE.md and correct the
stale claims found on the way (`/listings/me` no longer redirects; the i18n key
count is 2280, not 1715).

## Verification

```bash
npx tsc --noEmit      # 0 errors
pnpm lint             # 0 errors
pnpm test             # all green, including the new suites
pnpm build            # succeeds — catches the missing Suspense boundary
```

Then the spec's §10 checklist, item by item.

## Notes

- `offers.carrier_id → user.id`; `carrier_routes.carrier_id → carriers.id`. The
  bridge is `carriers.user_id`. This is the most likely bug in the feature.
- `real()` on every computed float reaching SQL, or Postgres infers `integer`
  and the query 500s — the board's documented post-mortem.
- The Vercel build does not migrate. Run *Actions → Migrate database* before the
  deploy or the tab 500s on a missing column.
