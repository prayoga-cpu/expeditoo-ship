# Specification: Carrier trips (`/carrier/trips`)

**Plan:** `docs/plans/plan_carrier_trips_and_billing.md`
**Related:** `docs/specs/billing_documents_spec.md`, `docs/specs/carrier_kyc_spec.md`,
`docs/specs/carriers_on_route_spec.md`
**Date:** 2026-08-26

---

## 1. Overview

One screen for the carrier, two tabs, as asked:

| Tab | Meaning |
|---|---|
| **Planifiés** (`planned`) | Routes the carrier *runs* — recurring (weekdays) or occasional (specific dates). Declared supply. |
| **Effectués** (`completed`) | Transports the carrier *carried out*. Execution history, with the money and documents attached. |

A trip is **private by default**. It is a saved query against the job board, not
an offer, not a commitment, and no operator sees it. A carrier may opt one trip
into being findable (`is_discoverable`), and even then it stays private in
substance: a requester whose own job runs along that trajet sees the carrier, the
trajet's two cities and its upcoming dates — never an address, a postal code, a
coordinate, a vehicle or a capacity. See §9 and `carriers_on_route_spec.md` §4.

## 2. User stories

- As an approved carrier, I declare that I drive Bordeaux → Paris every Tuesday
  and Thursday, so that I can find return loads without hunting the whole board.
- As an approved carrier, I declare that I am doing Lyon → Marseille on 12 and
  19 September, so the same is true for one-off runs.
- As a carrier, I open one trip and see the open jobs that match it.
- As a carrier, I look at everything I have actually carried out, what each one
  paid, and download the paperwork for a period.

## 3. Data model

### 3.1 `carrier_routes`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | nanoid |
| `carrier_id` | text NOT NULL → `carriers.id` cascade | person-level carrier, not the user |
| `label` | text NULL | free name, e.g. "Retour Bordeaux–Paris" |
| `kind` | `carrier_route_kind` NOT NULL | `recurring` \| `occasional` |
| `origin_address` / `origin_city` / `origin_postal_code` | text NOT NULL | |
| `origin_lat` / `origin_lng` | double NOT NULL | required — the whole point is geo matching |
| `destination_*` | same five columns | |
| `radius_km` | integer NOT NULL default 50 | matching tolerance, 1–500 |
| `days_of_week` | jsonb `number[]` default `[]` | ISO 1 (Mon) – 7 (Sun); recurring only |
| `valid_from` / `valid_until` | timestamp NULL | optional window for a recurring trip |
| `vehicle_id` | text NULL → `vehicles.id` set null | which vehicle runs it |
| `capacity_kg` | double NULL | usable payload on this trip |
| `notify_on_match` | boolean NOT NULL default true | stored now, consumed by a later cron |
| `is_discoverable` | boolean NOT NULL default true | publication consent, §9; existing rows backfilled `false` (`carriers_on_route_spec.md` §4.2) |
| `is_active` | boolean NOT NULL default true | pause without deleting |
| `created_at` / `updated_at` | timestamp NOT NULL | |

Indexes: `carrier_id`, `is_active`, `(is_discoverable, is_active)`.

### 3.2 `carrier_route_dates`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `route_id` | text NOT NULL → `carrier_routes.id` cascade | |
| `date` | timestamp NOT NULL | one specific date |

Unique on `(route_id, date)`. Index on `route_id`.

A separate table rather than a JSON array because dates are matched by range.

## 4. Validation rules

Enforced in Zod (`carrier-routes.dto.ts`), not in the UI.

| Rule | Error code | Status |
|---|---|---|
| `kind = recurring` requires ≥1 day in `daysOfWeek`, each 1–7, no duplicates | `VALIDATION_ERROR` | 400 |
| `kind = recurring` must not carry `dates` | `VALIDATION_ERROR` | 400 |
| `kind = occasional` requires ≥1 date, ≤ 60 dates, no duplicates | `VALIDATION_ERROR` | 400 |
| `kind = occasional` must not carry `daysOfWeek` | `VALIDATION_ERROR` | 400 |
| `validUntil` must be after `validFrom` when both present | `VALIDATION_ERROR` | 400 |
| `radiusKm` integer 1–500 | `VALIDATION_ERROR` | 400 |
| Origin and destination each need address, city, postal code, lat, lng | `VALIDATION_ERROR` | 400 |
| `capacityKg` positive when present | `VALIDATION_ERROR` | 400 |

Occasional dates in the past are **accepted** on write. A trip that has already
run is history, not an error, and rejecting it would break editing an existing
trip whose first date has passed. The UI marks them as elapsed and the match
query ignores them (§7).

## 5. Permissions

Every method resolves the caller's own carrier via
`carrierService.requireOwnCarrier(userId)`, the same guard the vehicles and
documents surfaces use. Consequences:

| Caller | Result |
|---|---|
| No session | `UNAUTHENTICATED` 401 (route level) |
| Session, no carrier record | `CARRIER_NOT_FOUND` 404 |
| Carrier suspended | `CARRIER_SUSPENDED` 409 — cannot create or edit trips |
| Carrier owns the route | allowed |
| Carrier does not own the route | `ROUTE_NOT_FOUND` 404 — never 403, so the id space is not probeable |

Admins and operators have **no** trip surface, and this API serves nobody but the
owning carrier. The one thing anyone else may read of a trip is the nine-field
projection of a **discoverable** trip (`carriers_on_route_spec.md` §4.3), shown to
a requester whose own job is on that trajet and served by
`carrier-discovery.service.ts` — never by a route in this spec.

`vehicleId`, when supplied, must belong to the same carrier — otherwise
`VEHICLE_NOT_FOUND` 404.

A carrier may hold at most **20** routes. The 21st answers `ROUTE_LIMIT_REACHED`
409. Inactive routes count; deleting is the way down.

## 6. API

All responses use the `src/lib/api-response.ts` envelope.

### `GET /api/carrier/routes`

Every route the caller owns, newest first, each with its `dates` and the
vehicle's plate and type when linked.

```json
{ "items": [ { "id": "…", "kind": "recurring", "…": "…" } ], "total": 3 }
```

### `POST /api/carrier/routes`

Body is `createCarrierRouteSchema`. Returns the created route with its dates,
`201`.

### `GET /api/carrier/routes/[id]`

One route. `ROUTE_NOT_FOUND` 404 if it is not the caller's.

### `PATCH /api/carrier/routes/[id]`

Body is `updateCarrierRouteSchema` — every field optional, but the same
kind-consistency rules apply to the **resulting** row, not the patch. Sending
`dates` replaces the whole set; omitting it leaves the set alone.

### `DELETE /api/carrier/routes/[id]`

Hard delete. Dates cascade. Returns `{ "id": "…" }`.

| Scenario | Code | Status |
|---|---|---|
| Not signed in | `UNAUTHENTICATED` | 401 |
| No carrier record | `CARRIER_NOT_FOUND` | 404 |
| Suspended carrier writing | `CARRIER_SUSPENDED` | 409 |
| Route belongs to someone else | `ROUTE_NOT_FOUND` | 404 |
| 21st route | `ROUTE_LIMIT_REACHED` | 409 |
| Vehicle is not the caller's | `VEHICLE_NOT_FOUND` | 404 |
| Kind/date/day mismatch | `VALIDATION_ERROR` | 400 |

## 7. Matching

No new engine. `routeMatchQuery(route)` maps a trip to the board's existing
`browseListingsQuerySchema` parameters:

| Trip field | Board param |
|---|---|
| `originLat` / `originLng` | `fromLat` / `fromLng` |
| `radiusKm` | `radiusKm` |
| `capacityKg` | `maxWeightKg` (omitted when null) |
| `destination_lat` / `destination_lng` | `toLat` / `toLng` |
| `origin_city` / `destination_city` | `fromLabel` / `toLabel` |
| upcoming occurrences (below) | `days` |
| — | `sort=distance_asc` |

**Upcoming occurrences.** The board filters on a set of days, so a trip sends
every run a carrier could still take, soonest first, capped at
`MAX_DEEP_LINK_DAYS` (8) and walked no more than eight weeks ahead.

- `occasional`: every stored date that is not in the past.
- `recurring`: each calendar day whose ISO weekday is in `daysOfWeek`, clamped
  to `validFrom`/`validUntil` when set.

If every occurrence has elapsed, `days` is omitted entirely and the trip
matches on geography alone.

The trip card links to `/expedion?` with those parameters. **The destination is
now a filter.** It was not: a carrier running Bordeaux → Paris will take a load
that ends anywhere near the corridor, and the board had no two-endpoint
predicate to express it, so distance from the origin was the honest
approximation. The board grew one — see `board_route_search_spec.md` §4 — and
the trip searches its corridor.

## 8. Screen behaviour

### 8.1 Tabs

`/carrier/trips` renders both tabs; the active one is held in the URL
(`?tab=planned` / `?tab=completed`) so the state survives a reload and a shared
link. Default is `planned`.

### 8.2 Planifiés

- One card per route: origin → destination, kind badge, the days as weekday
  chips or the dates as date chips (elapsed dates dimmed), radius, vehicle,
  capacity, an active/paused switch.
- Actions per card: **Voir les courses correspondantes** (deep-link, §7),
  **Modifier**, **Supprimer** (confirm dialog).
- Empty state through `centered-empty-state.tsx`.
- The form is a dialog: label, kind toggle, two `LocationPickerField`s, radius
  slider, weekday multi-select **or** a date list, vehicle select, capacity,
  notify switch, and a discoverability switch whose hint states exactly what a
  requester would see (§9, `carriers_on_route_spec.md` §4.3) — the old
  « Vous seul le voyez » copy is false once the switch exists.

### 8.3 Effectués

Reads `GET /api/shipments?status=DELIVERED,CANCELLED`. Per the Cocolis
reference each row is a card carrying:

- status pill (`DELIVERED` / `CANCELLED`),
- job title and the shipment reference,
- the amount,
- pickup and dropoff as two pinned lines,
- the delivery date,
- a link to the shipment, and the period-download control in the tab header.

Controls in the header: free-text search (title, reference, city), a period
select (`all` / `this_month` / `last_month` / `this_year`), and the
**Télécharger le relevé de la période** button — specified in
`billing_documents_spec.md` §4.

Search and period filtering are client-side over the fetched page in this pass;
the list is per-carrier and small. When it stops being small the same filters
move into `browseShipments`.

## 9. Non-goals, stated so they are not re-litigated

- ~~A trip is **not** visible to anyone but its carrier.~~ **Reversed on
  2026-09-05 by `carriers_on_route_spec.md` §4**: the client asked that a
  requester be able to see who already drives their trajet, so a carrier may now
  publish a trip to that surface. The reversal is opt-in per trip
  (`is_discoverable`) and bounded by the §4.3 projection — carrier, the two
  cities, the upcoming dates.
- What remains a non-goal: a trip is still **not** an offer, still **not** a price
  or availability commitment, and still does not enter the award queue. Being
  discoverable buys a conversation, nothing more.
- A trip is still not visible to operators as a trip; an operator reaches the
  same projection only through a job they may act on.
- `notifyOnMatch` is persisted and read by nothing yet.

## 10. Known limitations

1. ~~Matching uses the origin only; the destination is not a filter.~~ Closed:
   the board gained a corridor predicate and §7 now sends both endpoints
   (`board_route_search_spec.md` §4).
2. `daysOfWeek` is jsonb rather than a Postgres array, matching how `features`
   is stored on `vehicles`. It is never queried element-wise server-side.
3. Recurring occurrence maths runs in the server's timezone. The deadline
   columns elsewhere in this repo have the same property
   (`plan_expedion_post_payment_fork.md` §2.2); production runs `TZ=UTC`.
4. Every trip that existed before `is_discoverable` was backfilled to `false`,
   because it was declared under a dialog reading « Vous seul le voyez » and that
   promise outlives the change. New trips default to `true`, so the discoverable
   pool starts empty and fills only as drivers opt in — a product fact to
   communicate, not a bug (`carriers_on_route_spec.md` §4.2).

## 11. Test coverage required

- [ ] `requireOwnCarrier` rejects a caller with no carrier record (404)
- [ ] A suspended carrier cannot create or patch a route (409)
- [ ] Reading another carrier's route answers `ROUTE_NOT_FOUND`, not 403
- [ ] Recurring with no `daysOfWeek` rejected; occasional with no `dates` rejected
- [ ] Recurring carrying `dates` rejected; occasional carrying `daysOfWeek` rejected
- [ ] Duplicate dates and duplicate weekdays rejected
- [ ] `validUntil` before `validFrom` rejected
- [ ] 21st route answers `ROUTE_LIMIT_REACHED`
- [ ] A `vehicleId` owned by another carrier answers `VEHICLE_NOT_FOUND`
- [ ] PATCH with `dates` replaces the set; PATCH without `dates` preserves it
- [ ] `routeMatchQuery` picks the earliest future date for an occasional trip
- [ ] `routeMatchQuery` picks the next matching weekday for a recurring trip
- [ ] `routeMatchQuery` omits date bounds when every occurrence has elapsed
- [ ] `routeMatchQuery` omits `maxWeightKg` when `capacityKg` is null
