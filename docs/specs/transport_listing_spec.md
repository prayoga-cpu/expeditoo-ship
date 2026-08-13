# Spec — Transport Listing (the Job)

**Roadmap ref:** `ROADMAP.md` §8 Phase A "Listing form rebuild"
**Plan:** `docs/plans/plan_phase_a_bidding_core.md` WP3, WP5

A listing is a **transport job**: what moves, from where to where, when, and what
the shipper expects to pay. It is not an item for sale.

---

## 1. Lifecycle

```
draft ──publish──► open ──accept offer──► awarded ──pickup──► in_progress ──deliver──► completed
                    │                        │                     │
                    ├──cancel──► cancelled ◄──┘                     │
                    └──expiresAt reached──► expired                 │
                                                    cancel (with refund) ─► cancelled
```

- `draft` — created but not published. Not visible to carriers. No offers possible.
- `open` — live on the marketplace, accepting offers.
- `awarded` — an offer is accepted, payment authorised, shipment created.
- `in_progress` — mirrors the shipment once pickup happens.
- `completed` — delivered and payment captured.
- `cancelled` / `expired` — terminal.

Only `open` listings accept offers (`docs/specs/offers_engine_spec.md` §3).

---

## 2. Fields

### What

| Field | Type | Rules |
|---|---|---|
| `title` | text | 5–120 chars, required |
| `description` | text | 20–5000 chars, required |
| `categoryId` | fk | required, must exist |
| `weightKg` | numeric | > 0, ≤ 44 000 (French road limit), required |
| `lengthCm` `widthCm` `heightCm` | numeric | > 0 each, optional but all-or-nothing |
| `quantity` | int | ≥ 1, default 1 |
| `isFragile` | bool | default false |
| `needsHelp` | bool | default false — carrier must assist with loading |

### Where

`pickup*` and `dropoff*` each carry `Lat`, `Lng`, `Address`, `City`, `PostalCode`,
`LocationType`.

- Coordinates required; France only in v2.0 (`ROADMAP.md` §9) — reject coordinates
  outside metropolitan France + Corsica → `400 LOCATION_OUT_OF_COUNTRY`.
- `PostalCode` must match `/^\d{5}$/` → else `400 INVALID_POSTAL_CODE`.
- Pickup and dropoff must differ by ≥ 500 m → else `400 PICKUP_DROPOFF_TOO_CLOSE`.

**The 13 location types** (`location_type` enum):

```
house · apartment · warehouse · factory · construction_site · shop · office
storage_unit · farm · port · airport · rail_terminal · other
```

`apartment` requires `floor` (int ≥ 0) and `hasLift` (bool) — they materially change
the job. Enforced by Zod refinement, not by the UI alone.

### When

| Field | Type | Rules |
|---|---|---|
| `pickupFrom` `pickupUntil` | timestamp | `pickupFrom ≥ now`, `pickupFrom < pickupUntil` |
| `dropoffFrom` `dropoffUntil` | timestamp | `dropoffFrom ≥ pickupFrom`, `dropoffFrom < dropoffUntil` |
| `isFlexible` | bool | when true, carriers may bid outside the windows |
| `expiresAt` | timestamp | default `pickupFrom − 6h`, never later than `pickupFrom` |

### Money

| Field | Type | Rules |
|---|---|---|
| `budgetCents` | int | ≥ 100, ≤ 10 000 000. The shipper's **expectation**, not a cap |
| `acceptedOfferId` | fk | null until awarded |

Carriers may bid above budget (`offers_engine_spec.md` edge case 7).

### Bridge (Phase B — columns only)

| Field | Rules |
|---|---|
| `origin` | `'direct'` \| `'expedion'`, default `'direct'` |
| `externalRef` | nullable; required when `origin = 'expedion'` |

---

## 3. Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/listings` | shipper | Creates `draft` or `open` via `publish: bool` |
| `GET` | `/api/listings` | any | Marketplace browse; only `open` |
| `GET` | `/api/listings/:id` | any | Non-owners never see `draft` → `404` |
| `PATCH` | `/api/listings/:id` | owner | §4 |
| `POST` | `/api/listings/:id/publish` | owner | `draft` → `open` |
| `POST` | `/api/listings/:id/cancel` | owner or admin | §5 |
| `GET` | `/api/listings/me` | owner | The shipper's own, any status |

### Browse filters (`GET /api/listings`)

`categoryId`, `q` (FTS over title + description, French config — the existing
`listing_search_idx` GIN index is retained), `nearLat`/`nearLng`/`radiusKm`,
`minBudget`/`maxBudget`, `pickupFrom`/`pickupUntil`, `maxWeightKg`, `sort`
(`created_desc` default, `budget_desc`, `budget_asc`, `pickup_asc`, `distance_asc`),
`page`/`limit` (limit ≤ 50).

A carrier browsing sees `hasBid: boolean` on each row so the UI can mark jobs
already bid on.

---

## 4. Editing after publication

Edits split by whether they change what a carrier priced:

**Material** — `weightKg`, dimensions, `quantity`, pickup/dropoff coordinates,
pickup/dropoff windows, `needsHelp`, `isFragile`, location types.
Editing any of these while `pending` offers exist expires all of them and notifies
the carriers to re-bid (`offers_engine_spec.md` edge case 4). The response includes
`invalidatedOffers: number` so the UI can warn **before** submitting.

**Non-material** — `title`, `description`, `budgetCents`, photos. Offers survive.

No edits at all once `awarded` → `409 LISTING_NOT_EDITABLE`.

---

## 5. Cancellation

| Listing status | Effect |
|---|---|
| `draft` | Hard delete, photos purged |
| `open` | → `cancelled`, pending offers → `rejected`, carriers notified |
| `awarded` | → `cancelled`, Stripe authorisation **released** (never captured), shipment cancelled, carrier notified. Repeated cancellations at this stage are flagged for admin review |
| `in_progress` | Shipper cannot self-cancel → `409 CANCEL_REQUIRES_SUPPORT` |
| `completed` | → `409 LISTING_NOT_CANCELLABLE` |

---

## 6. Photos

- 0–10 per listing, ≤ 8 MB each, `image/jpeg|png|webp`.
- Processed with Sharp, stored on R2 via the existing `/api/upload` route.
- Photos are optional here — unlike a goods marketplace, a transport job is often
  described in text alone.
- Orphan photos are purged by the existing `cron/cleanup-images` job.

---

## 7. Edge cases

| # | Case | Behaviour |
|---|---|---|
| 1 | `pickupFrom` in the past at publish time | `400 PICKUP_IN_PAST` — checked at publish, not at draft creation |
| 2 | `expiresAt` computed to a past time (job posted < 6 h before pickup) | Clamp to `now + 30 min`; if that exceeds `pickupFrom`, reject `400 PICKUP_TOO_SOON` |
| 3 | Weight given, dimensions omitted | Allowed. Vehicle capacity check falls back to weight only |
| 4 | Geocoding fails for a typed address | Reject `400 ADDRESS_NOT_GEOCODABLE`; the UI requires a picked suggestion |
| 5 | Shipper publishes with no payment method | Allowed — payment is only required at accept time (`offers_engine_spec.md` §5) |
| 6 | Same shipper posts duplicate jobs | Allowed, no dedup in Phase A |

---

## 8. Test coverage required

`src/server/services/__tests__/listings.service.test.ts`:

- Every validation rule in §2, both sides of each boundary.
- Publish transitions and the `expiresAt` clamp (edge case 2).
- Material vs non-material edit behaviour (§4), asserting offer invalidation counts.
- Cancellation matrix (§5) including the Stripe release path.
- Browse filter correctness, especially radius search and the `hasBid` flag.
