# Plan: delivery history on "Mes demandes"

**Ask (client, verbatim):** «"Mes demandes" — history. Add a history of delivered
items, mentioning the transporter for each one.»

---

## 1. What is missing today

`/listings/me` lists every request the caller posted and nothing else. Its
payload is the raw `listings` row — `listingsDal.getByShipperId`
(`src/server/dal/listings.dal.ts:208-221`) loads only `{ photos, category }` —
so the page **cannot name a transporter**. Nothing on the listing read path
joins a shipment, `listingsRelations` (`src/db/schema/listings.ts:193-203`)
declares no shipment, and `Job.shipper` (`types.ts:83`) is the *poster*, not the
driver.

A requester can already reach a delivered run at `/deliveries` → *Passées*,
which names the counterpart (`useDeliveries.ts:58`). That surface is about
shipments. The client asked for the history to live where they look for their
own requests, so this puts it there.

## 2. Source of truth

**`shipments.status = 'DELIVERED'`, timestamped by `shipments.deliveredAt`** —
not `listings.status = 'completed'`.

`shipment.service.ts:253-255` (status change) and `:291-292` (proof upload)
write the listing to `completed` right after the shipment transition, but **not
in the same transaction**, so a listing can sit at `awarded`/`in_progress`
behind a delivered shipment. The listing also carries no delivery timestamp to
order a history by. The shipment is the fact; the listing status is a
consequence.

## 3. Shape of the change

One extra, batched query on the existing endpoint — no new route, no envelope
change, no migration.

`listingsService.getMyListings` keeps its signature and gains a second step: it
takes the listing ids it just read and asks the shipments DAL which of them were
delivered, then attaches a `delivery` block to those rows. Both tabs are served
by the one request they already make.

| # | Layer | File | Change |
|---|---|---|---|
| 1 | DAL | `src/server/dal/shipments.dal.ts` | **new** `listDeliveredForListings(listingIds)` — explicit `select`, `LEFT JOIN user` on `carrierId` |
| 2 | Service | `src/server/services/listings.service.ts` | `getMyListings` attaches `delivery` |
| 3 | Route | `src/app/api/listings/me/route.ts` | unchanged |
| 4 | Types | `src/features/app/listing/types.ts` | **new** `JobDelivery`, `JobDeliveryCarrier`; `Job.delivery` |
| 5 | Hooks | `src/features/app/listing/hooks/useMyRequests.ts` | **moved** from `listings/me/useMyJobs.ts`; **new** `useDeliveryHistory` |
| 6 | UI | `src/features/app/listing/ui/MyRequestsScreen.tsx` | **new** tab shell |
| 7 | UI | `src/features/app/listing/ui/MyRequestsPanel.tsx` | **moved** from `MyJobs.tsx` |
| 8 | UI | `src/features/app/listing/ui/DeliveryHistoryPanel.tsx` | **new** |
| 9 | UI | `src/features/app/listing/ui/DeliveredRequestCard.tsx` | **new** |
| 10 | Page | `src/app/(app)/(main)/listings/me/page.tsx` | `Suspense` + `MyRequestsScreen`; delete `MyJobs.tsx`, `useMyJobs.ts` |
| 11 | i18n | `messages/{fr,en}.json` | `myJobs.tabs.*`, `myJobs.history.*` |
| 12 | Tests | service + UI | §6 |

### 3.1 Two queries, not a relation

The obvious move — a `shipment` relation on `listingsRelations` and a nested
`with` — is rejected. `src/db/schema/shipments.ts:13` already imports
`listings`, so declaring the reverse makes the two schema files import each
other. Drizzle's lazy `relations()` usually tolerates that; "usually" is not a
reason to introduce a module cycle into the schema layer when a second batched
query costs one round trip and no risk.

Keeping `getByShipperId` untouched also means `/api/users/[id]/listings`, which
calls the same DAL function, is unaffected.

### 3.2 The projection is explicit, deliberately

`shipmentsDal`'s shared `withParties` bundle loads each party as a **full user
row**, and `redactForDriver` (`shipment.service.ts:136`) narrows it only for a
driver viewer — so `GET /api/shipments` already hands a shipper the carrier's
`email`, `stripeAccountId`, `banned` and `preferences`. The new query names its
columns so it cannot inherit that. The leak on the shipments read path is real
but is not this feature's to fix; it is recorded in the spec.

## 4. What the row shows, and why that set

Only fields **already rendered** to this same viewer:

| Field | Precedent |
|---|---|
| carrier `name` | `DeliveryCard.tsx:41`, `OfferCard.tsx:56` |
| carrier `image` | `DeliveryDetail.tsx:199`, `OfferCard.tsx:48` |
| carrier `rating` | `OfferCard.tsx:69-70` |
| price paid | `CompletedTripCard.tsx:66` |

Excluded: `carriers.companyName`, `completedJobs` and `averageRating` — declared
in `offers.dto.ts:141-147` but populated and rendered by nothing, and
`carriers.averageRating` is a *different, stale* number from `user.rating`,
which is the one `reviewsService.refreshAggregates` maintains. Excluded too:
`contactPhone`, `email`, SIRET, IBAN, KYC. Policy sentence at
`offers.dto.ts:136-140` — *the shipper sees a reputation, not an identity
document.*

## 5. UI shape

Two tabs on `/listings/me`, mirroring `/carrier/trips` — a shape the client
already approved for the carrier side.

- **Demandes** — today's list, status filter intact. Nothing is removed, so
  cancelled and expired requests stay exactly where they were.
- **Historique** — delivered requests, newest delivery first, one card each:
  the transporter (avatar, name, rating), delivery date, price paid, route, a
  delivery-photo marker, and a link to `/deliveries/{shipmentId}`, where the
  photos and the "rate the carrier" flow already live
  (`DeliveryDetail.tsx:121,310`).

The history tab always reads the unfiltered list, so the other tab's status
filter cannot hide a delivery. React Query serves both from one cache entry.

Tab held in the URL (`?tab=history`) with `router.replace(..., { scroll: false })`,
copying `CarrierTripsScreen.tsx:24-33`. The page therefore needs a `Suspense`
boundary — `useSearchParams` without one passes `tsc` and fails `pnpm build`.

The tabs overlap on delivered requests by design: the first is the working list
of everything posted, the second is the record of what arrived.

## 6. Tests

Service: delivery attached only to `DELIVERED` shipments; a delivered shipment
whose listing is still `in_progress` still gets one; no listings means no second
query; a carrier row that does not resolve yields `carrier: null`.

UI: the transporter's name renders; the unknown-transporter fallback; the empty
state; the `isError` branch (CLAUDE.md gotcha 9); `?tab=history` opens the right
tab; and a `NextIntlClientProvider` `onError` assertion in both locales, because
the status keys are reached by template.

## 7. Non-goals

- No pagination. `getByShipperId` is unbounded today and stays that way; capping
  it now would silently drop rows from the existing tab.
- No `carriers.companyName`. The transporter is a person here.
- No output DTO for the listing payload. The route has never had one and adding
  it means shaping every listing field — a separate change, recorded as a
  limitation rather than smuggled in.
- No widening of `/api/listings/me` beyond the caller's own `shipperId`.
