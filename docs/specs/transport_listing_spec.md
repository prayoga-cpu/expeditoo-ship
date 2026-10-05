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

> **Amended (2.60.0).** `scheduled` sits between `draft` and `open`: published
> for a later moment, invisible to carriers until `publishScheduled` turns it
> `open` — or `expired`, when its pickup window closed first
> (`publication_timing_spec.md`). Neither `draft` nor `scheduled` is final:
> the owner finishes, re-schedules or publishes either through
> `PUT /api/listings/:id/draft`, turns a `scheduled` one back into a `draft`
> with `POST /api/listings/:id/unschedule`, and deletes either outright with
> `DELETE /api/listings/:id/draft` (`draft_requests_spec.md` §1–§4).
> `published_at` records the moment a request first went live (§5 there).

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
`LocationType`, `Note`, `ContactName`, `ContactPhone`.

- Coordinates required; France only in v2.0 (`ROADMAP.md` §9) — reject coordinates
  outside metropolitan France + Corsica → `400 LOCATION_OUT_OF_COUNTRY`.
- `PostalCode` must match `/^\d{5}$/` → else `400 INVALID_POSTAL_CODE`.
- Pickup and dropoff must differ by ≥ 500 m → else `400 PICKUP_DROPOFF_TOO_CLOSE`.
- `Note` is free-text access instructions for the carrier ("second floor, past
  the red door"), optional, ≤ 300 characters at the DTO. `ContactName` is who
  the carrier should ask for there, optional, ≤ 120 characters — the requester
  posting the job is not always the person present at either end.
  `ContactPhone` is who the carrier actually calls: required and validated as a
  French number (`isValidFrenchPhone`) on the direct-posting form
  (`create/schemas.ts`), but only ≤ 30 characters at the DTO — an
  Expedion-escalated listing is populated from `expedion_quotes.pickup_phone` /
  `delivery_phone`, free-typed and nullable Airtable-imported data the server
  cannot hold to the same standard without breaking escalation. All three are
  columns on `listings` (nullable, since an existing row predates them) and are
  copied onto `shipments` at award, same as `pickupAddress`/`dropoffAddress`,
  so the driver executing the run keeps them even if the listing is later
  edited.

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
| `POST` | `/api/listings` | any session | Creates `draft`, `scheduled` or `open` (`publish`, `scheduledPublishAt`). No role check (`transport_request_spec.md`) |
| `GET` | `/api/listings` | session — `401` without | The board; only `open`. Each row projected for the viewer (`listing_privacy_spec.md` §3) |
| `GET` | `/api/listings/:id` | none needed | A job stays a shareable link; projected for the viewer. `draft` and `scheduled` → `404` for anyone but the owner |
| `PATCH` | `/api/listings/:id` | owner | §4 |
| `DELETE` | `/api/listings/:id` | owner or admin | §5 (`cancelListing`). An `awarded` job → `409 CANCEL_VIA_SHIPMENT`: it is cancelled on its shipment (`cancellations_spec.md` §8) |
| `GET` | `/api/listings/me` | session | The caller's own, any status |
| `GET` | `/api/listings/:id/draft` | owner | A `draft` or `scheduled` request, to resume it. `404` for anyone else, `409 LISTING_NOT_DRAFT` once live |
| `PUT` | `/api/listings/:id/draft` | owner | Saves it again, schedules it or publishes it now; the body is `createListingSchema` |
| `DELETE` | `/api/listings/:id/draft` | owner | Hard-deletes a `draft` or `scheduled` request |
| `POST` | `/api/listings/:id/unschedule` | owner | `scheduled` → `draft`; `409 LISTING_NOT_SCHEDULED` otherwise |

> **Amended (2.60.0).** This table listed `POST /api/listings/:id/publish` and
> `POST /api/listings/:id/cancel`; neither route ever existed. A draft goes
> live through `PUT …/draft` (`draft_requests_spec.md` §3), and
> `listingsService.publishListing`, which no route called, is removed.
> Cancelling is `DELETE /api/listings/:id`. The board needs a session since
> 2.60.0; a job's own link deliberately does not. "Owner" is enforced by the
> service; the route only requires a session. The four `…/draft` and
> `…/unschedule` rows are specified in `draft_requests_spec.md` §2–§4 and §6.
>
> The other routes under `/api/listings/:id/` act on a job rather than edit
> it, and are specified where they live: `offers` (`offers_engine_spec.md`),
> `take` (`take_job_spec.md`), `revoke-award` (`cancellations_spec.md`),
> `carriers` and `carriers/:matchId/contact` (`carriers_on_route_spec.md`).

### Browse filters (`GET /api/listings`)

`categoryId`, `q` (FTS over title + description, French config — the existing
`listing_search_idx` GIN index is retained), `fromLat`/`fromLng`/`radiusKm`,
`toLat`/`toLng`, `days`/`slots`/`tzOffset`, `minBudget`/`maxBudget`,
`pickupFrom`/`pickupUntil`, `maxWeightKg`, `sort`
(`created_desc` default, `budget_desc`, `budget_asc`, `pickup_asc`, `distance_asc`),
`page`/`limit` (limit ≤ 50). Since 2.60.0 `created_desc` orders by
publication — `published_at`, falling back to `created_at` — and every sort
ends on the unique `reference`, so two pages never share or skip a row
(`draft_requests_spec.md` §5).

The location and availability parameters are specified in
`board_route_search_spec.md`: an arrival turns the radius filter into a
corridor, and `days`/`slots` narrow a job's pickup window to the times the
driver can actually drive.

A carrier browsing sees `hasBid: boolean` on each row so the UI can mark jobs
already bid on.

> **Not built** (found 2.60.0). No server code has ever set `hasBid`: the
> client's `BoardJob` declares it optional and `JobCard` renders a marker when
> it is true, so the marker never shows. Recorded here rather than left as a
> promise.

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

> **Superseded for `awarded` and `in_progress`.** `DELETE /api/listings/:id`
> refuses both with `409 CANCEL_VIA_SHIPMENT`: a job with a driver is
> cancelled on its shipment, and the client is refunded, not released
> (`cancellations_spec.md` §4, §6, §8). Since 2.60.0 the owner deletes a
> `draft` or `scheduled` request through `DELETE /api/listings/:id/draft`
> (§3).

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
| 2 | `expiresAt` computed to a past time (job posted < 6 h before pickup) | Clamp to `now + 30 min`; if that exceeds `pickupFrom`, reject `400 PICKUP_TOO_SOON` — also at publish only. Until 2.59.0 a draft was refused here too, which contradicted row 1; a draft now stores a placeholder `expires_at` and no schedule (`publication_timing_spec.md` §2) |
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
- Browse filter correctness, especially radius search. (The `hasBid` flag this
  line also named was never built — §3.)
- Who reads what on `browse` and `getListing`, and the `404` on a `draft` or
  `scheduled` request for anyone but its owner: `listing_privacy_spec.md` §5.
- The draft routes (§3): `draft_requests_spec.md` §7.
