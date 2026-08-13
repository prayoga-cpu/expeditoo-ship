# Plan — Phase A: Bidding Core

**Status:** In progress
**Roadmap ref:** `ROADMAP.md` §8 Phase A
**Exit criteria:** A shipper can post a job, three carriers can bid, the shipper accepts one and pays.

---

## 1. Context

The codebase implements a **goods marketplace** (auctions + direct sale + a bolt-on
delivery step). `ROADMAP.md` v2.0 describes a **reverse-bidding transport
marketplace** with no goods auctions at all. Phase A is the pivot.

The pivot is smaller than it looks, because the reverse-bidding mechanic already
exists in the wrong place: `shipment_proposals` (price + estimated pickup +
estimated delivery + message + status) is a working prototype of the offers
engine, anchored to `shipments` instead of `listings`.

### Conceptual change

| Concept | Today | Phase A |
|---|---|---|
| `listings` | An item for sale (condition, category, auction/direct_sale, winner) | A **transport job** (what / where / when / budget) |
| `bids` | Ascending money bids on an item | **Deleted** |
| `shipment_proposals` | Driver quotes on an already-sold item | Becomes **`offers`** — carrier bids on a job |
| `orders` | Won-auction checkout | **Deleted** — payment hangs off the accepted offer |
| `shipments` | The delivery of a sold item | The **execution record** created when an offer is accepted |
| `transporter_profiles` | Driver profile with JSONB vehicle | Split into **`carriers`** + **`vehicles`** |

### Decisions taken (2026-08-13)

1. **Roles: 7** — `shipper`, `carrier`, `driver`, `operator`, `support`, `finance`, `admin`.
2. **Greenfield** — no production data. The Drizzle schema is remodelled directly,
   `src/db/migrations` is wiped and a single clean initial migration regenerated.
3. Phase A is implemented through to its exit criteria in reviewable commits.

### Deliberately deferred

- `listings.origin` / `listings.external_ref` and the Expedion bridge → **Phase B**.
  The columns are added in Phase A (cheap, and they are part of the target schema)
  but no escalation endpoint or write-back is built.
- Stripe Connect **payouts**, insurance, i18n audit → **Phase C**.
- Route publishing and matching → **Phase D**.

---

## 2. Target data model

Per `ROADMAP.md` §5. Tables marked ✚ are new, ✎ remodelled, ✖ dropped.

```
users              ✎  7-role enum
profiles           ✚  split out of user (display data)
carriers           ✚  company account: SIRET, KYC docs, IBAN/BIC, approval
vehicles           ✚  one carrier → many vehicles (was JSONB on transporter)
listings           ✎  transport job
photos             ✎  renamed from listing_images
offers             ✚  carrier bid on a listing (from shipment_proposals)
categories         ✎  transport categories, not goods categories
conversations      ·  unchanged
messages           ·  unchanged
shipments          ✎  created on offer acceptance; loses listing/goods coupling
payments           ✎  absorbs orders' payment fields
payouts            ✚  carrier side of the money (skeleton only in Phase A)
reviews            ✎  shipper ↔ carrier, both directions
notifications      ·  unchanged

bids               ✖  goods auction
orders             ✖  won-auction checkout
transporter_profiles ✖  superseded by carriers + vehicles
```

### `listings` — the transport job

```ts
listings {
  id
  shipperId            -> user.id        // was sellerId
  categoryId           -> categories.id
  status               'draft'|'open'|'awarded'|'in_progress'|'completed'|'cancelled'|'expired'

  // What
  title, description
  weightKg, lengthCm, widthCm, heightCm
  quantity, isFragile, needsHelp

  // Where  (13 location types per ROADMAP Phase A)
  pickupLat/Lng/Address/City/PostalCode, pickupLocationType
  dropoffLat/Lng/Address/City/PostalCode, dropoffLocationType

  // When
  pickupFrom, pickupUntil, dropoffFrom, dropoffUntil, isFlexible

  // Money
  budgetCents                             // shipper's price expectation
  acceptedOfferId      -> offers.id

  // Phase B bridge (columns only)
  origin               'direct'|'expedion'  default 'direct'
  externalRef

  offersCount, views, createdAt, updatedAt, expiresAt
}
```

Dropped from today's listings: `condition`, `type`, `size`, `startPrice`,
`buyNowPrice`, `currentPrice`, `winnerId`, `endsAt`.

### `offers` — the reverse bid

```ts
offers {
  id
  listingId  -> listings.id
  carrierId  -> user.id
  vehicleId  -> vehicles.id
  priceCents                    // carriers compete DOWNWARD
  estimatedPickup, estimatedDelivery
  message
  status     'pending'|'accepted'|'rejected'|'withdrawn'|'expired'
  createdAt, updatedAt
  UNIQUE (listingId, carrierId) WHERE status <> 'withdrawn'
}
```

---

## 3. Work packages

Ordered. Each is a commit.

### WP1 — Schema remodel *(foundation)*

- `src/db/schema/users.ts` — 7-role enum; strip auction keys from `UserPreferences`.
- `src/db/schema/listings.ts` — transport job per §2; `listing_images` → `photos`.
- `src/db/schema/offers.ts` ✚ — replaces `auctions.ts`.
- `src/db/schema/carriers.ts` ✚ — `carriers` + `vehicles`, replaces `transporters.ts`.
- Delete `auctions.ts`, `orders.ts`, `transporters.ts`.
- `shipments.ts` — drop `shipmentProposals` (becomes `offers`); anchor to `listingId` + `offerId`.
- Wipe `src/db/migrations`, `pnpm db:generate` for one clean initial migration.

**Verify:** `pnpm db:generate` produces a migration with no residual auction/order tables.

### WP2 — Strip goods-auction modules

Delete outright:

```
src/features/app/auction/                     (AuctionCard, AuctionDetail, AutoBidDialog, MyBids, useAuctionDetail, useMyBids)
src/app/(app)/(main)/auction/[id]/
src/app/(app)/(main)/my-auctions/  my-bids/
src/app/(app)/(main)/checkout/won/[listingId]/
src/app/api/auctions/                         (bid, bids)
src/app/api/listings/[id]/bid/  bids/  repost/
src/app/api/user/bids/
src/app/api/cron/close-auctions/
src/app/api/orders/
src/server/{services,dal,dto}/auctions.*  bids.*  orders.*
src/server/emails/{AuctionEndedSeller,AuctionLost,ItemPaidSeller}Email.tsx
```

Then sweep the ~87 files referencing `auction`/`bid` for dangling imports and copy.

**Verify:** `pnpm lint` and `npx tsc --noEmit` clean; no `auction` identifier remains in `src/`.

### WP3 — Server layer: listings + offers

Strict `DTO → DAL → Service → Route` per `docs/rules.md`.

- `dto/listings.dto.ts` — rewrite for the transport job; 13 location types; Zod refinements
  (pickup window before dropoff window, budget > 0, dimensions positive).
- `dto/offers.dto.ts` ✚ — create/update/withdraw/accept.
- `dal/listings.dal.ts` — rewrite queries (geo + status + category filters, offer counts).
- `dal/offers.dal.ts` ✚ — from `bids.dal.ts` + proposal queries in `shipments.dal.ts`.
- `services/listings.service.ts` — rewrite; publish, expire, award.
- `services/offers.service.ts` ✚ — submit / withdraw / accept, with the invariants in the spec.
- Routes: `POST|GET /api/listings/[id]/offers`, `POST /api/offers/[id]/accept`,
  `POST /api/offers/[id]/withdraw`, `GET /api/carrier/offers`.

**Verify:** unit tests in `src/server/services/__tests__/offers.service.test.ts`
cover every invariant in `docs/specs/offers_engine_spec.md`.

### WP4 — Carrier KYC

- Extend `driver_applications` → `carrier_applications`: CNI recto/verso, driving
  licence, vehicle registration, IBAN/BIC, RIB upload, SIRET, insurance certificate.
- Reuse the existing R2 upload pipeline (`/api/upload`) with a private bucket prefix
  for KYC documents — these must **not** be publicly readable.
- Admin approve/reject already exists (`/api/admin/driver-applications/[id]/approve`);
  re-point at carriers and grant the `carrier` role on approval.

**Verify:** an unapproved carrier receives 403 from `POST /api/listings/[id]/offers`.

### WP5 — Client + UI

- `features/app/create/` — rebuild the multi-step form as the transport job form
  (what → where → when → budget → review).
- `features/app/listing/` — job detail; offers list for the shipper with compare + accept.
- `features/app/offers/` ✚ — carrier-side submit-offer form and "my offers".
- `features/app/home/` — browse jobs; retarget filters from goods to transport.
- Delete auction UI entry points from nav, home cards, splash, marketing copy.

All new surfaces must ship **light and dark** per `ROADMAP.md` §7, use
`centered-empty-state.tsx` for empties and `page-wrapper.tsx` for transitions.

### WP6 — Payment on acceptance

- Accepting an offer authorises payment via Stripe (`payments`), then creates the
  `shipment` with `listingId` + `offerId` + `carrierId`.
- Commission: 10% held at source (`ROADMAP.md` §1). Payout transfer itself is Phase C —
  Phase A records the intent in `payouts` without moving money.
- Rewrite `services/orders.service.ts` logic that survives into
  `services/payments.service.ts`; delete the rest.

**Verify:** exit criteria E2E — `testing/scripts/e2e-post-bid-accept.spec.ts`.

### WP7 — Docs + roadmap

- Rewrite `CLAUDE.md` (it currently claims "no backend implemented", which is false).
- Retire the goods-marketplace specs under `docs/specs/` that no longer describe the product.
- Tick Phase A items in `ROADMAP.md`.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| The strip touches ~87 files; easy to leave dangling imports | `tsc --noEmit` gate after WP2, before any new feature work |
| `shipments` is the largest service (26 KB) and is coupled to `orders` | Read it fully before WP6; do not refactor it during WP2, only unwire |
| `listings` remodel breaks search (`listing_search_idx` FTS on title+description) | Keep the GIN index; it still applies to the job title/description |
| Roles 5 → 7 has no roadmap definition | Resolved by decision above; recorded in `docs/specs/roles_spec.md` |
| Deleting `orders` loses invoice/earnings coupling | `invoices` and `earnings` re-point at `shipments`, not `orders` |

---

## 5. Open items for the client

Carried from `ROADMAP.md` §10, none blocking Phase A:

1. Auto-escalation window duration — Phase B.
2. Commission split for Expedion-originated jobs — Phase B.
3. Insurance partner — Phase C.
4. KYC vendor — WP4 assumes manual admin review, no vendor.
