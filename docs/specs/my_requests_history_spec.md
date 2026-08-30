# Specification: delivery history on "Mes demandes" (`/listings/me?tab=history`)

Extends `/listings/me`. The screen as it was is untouched and becomes the first
of two tabs.

---

## 1. Overview

`/listings/me` gains a second tab, **Historique**, listing the caller's
transport requests that were actually delivered, each one naming the transporter
who delivered it.

The first tab, **Demandes**, is the screen as it was: every request the caller
posted, in any state, with its status filter. Nothing reachable before is harder
to reach now.

The two tabs overlap on delivered requests deliberately. The first is the
working list of everything posted; the second is the record of what arrived, and
only it names a transporter.

## 2. User stories

- As a requester I open Mes demandes → Historique and see, newest first, every
  delivery I received, with the name of the person who drove it.
- As a requester I recognise a past transporter by their photo and rating, and
  tell one delivery from another by route, date and price.
- As a requester I follow a history row to the shipment, where the proof of
  delivery and the review form already are.

## 3. Source of truth

A request enters the history when **its shipment reached `DELIVERED`** —
`shipments.status = 'DELIVERED'` — ordered by `shipments.deliveredAt`
descending, newest first.

Not `listings.status = 'completed'`. The listing is closed by a second, separate
write immediately after the shipment transition (`shipment.service.ts:253-255`
for a status change, `:291-292` for a proof-of-delivery upload). Those two
writes are **not in one transaction**, so a listing can sit at `awarded` or
`in_progress` behind a delivered shipment, and `listings` carries no delivery
timestamp to order by. `DELIVERED` is the fact; `completed` is a consequence.

Scope is the caller's own `listings.shipperId`, unchanged from today. Escalated
jobs belong to the Expedion system account, which no human signs into, so they
never enter a requester's history. The where clause is **not** widened to
`externalRef` or `firebase_uid` to "help" Expedion clients find theirs — that is
the email-matched-claiming trap `admin_expedion_clients_spec.md` was written
against.

## 4. Data

`GET /api/listings/me` is unchanged in shape and status filtering. Each returned
job gains one optional block:

```ts
interface JobDeliveryCarrier {
  id: string;
  name: string;
  image: string | null;
  rating: number;
}

interface JobDelivery {
  shipmentId: string;
  /** `shipments.deliveredAt`. Null only for a row delivered before the column
   *  was stamped; the card then omits the date rather than inventing one. */
  deliveredAt: string | null;
  /** `shipments.priceCents` — the agreed price, from the accepted offer. */
  priceCents: number;
  /** Whether any live `shipment_photos` row exists at stage `delivery`. */
  hasProofOfDelivery: boolean;
  /** Null when the carrier's user row does not resolve. §7.3. */
  carrier: JobDeliveryCarrier | null;
}
```

`Job.delivery` is present **only** when a shipment for that listing has
`status = 'DELIVERED'`. It is `null` otherwise — including for a listing whose
own status reads `completed` but which has no delivered shipment behind it
(§9.2).

`shipment_listing_idx` is a plain index, not a unique one, so a listing can in
principle carry more than one delivered shipment — an award revoked after
delivery would do it. The rows come back newest first and the service keeps the
**first** it sees for a listing, because `new Map(entries)` keeps the *last* of
a repeated key and would otherwise surface the delivery that was superseded.

### 4.1 Why exactly these transporter fields

`name`, `image` and `rating` are the three already rendered to this same viewer:
`DeliveryCard.tsx:41` and `OfferCard.tsx:56` (name), `DeliveryDetail.tsx:199`
and `OfferCard.tsx:48` (image), `OfferCard.tsx:69-70` (rating).

Excluded on purpose:

- `carriers.companyName`, `carriers.completedJobs`, `carriers.averageRating` —
  declared in `offerCarrierPublicSchema` (`offers.dto.ts:141-147`) but populated
  and rendered by nothing. `carriers.averageRating` is also a **different
  number** from `user.rating`; only the latter is maintained by
  `reviewsService.refreshAggregates`, so the former would print a stale zero.
- `carriers.contactPhone`, `user.email`, SIRET, IBAN, any `carrier_documents` —
  the sanctioned channel is in-app messaging. Policy sentence at
  `offers.dto.ts:136-140`: *the shipper sees a reputation, not an identity
  document.*
- the delivery photos themselves — `shipment_photos` rows hold private R2
  object keys that are never serialised to a client. The history carries an
  `EXISTS` over them as a boolean marker; the photos are read one at a time
  through their authorising route at `/deliveries/{shipmentId}`.

### 4.2 Why the query names its columns

`shipmentsDal`'s shared `withParties` bundle loads each party as a **full user
row**, and `redactForDriver` (`shipment.service.ts:136`) narrows it only when
the viewer is a driver. `GET /api/shipments` therefore already hands a shipper
the carrier's `email`, `stripeAccountId`, `banned` and `preferences`.

`listDeliveredForListings` selects named columns so it cannot inherit that. "It
is already in the JSON elsewhere" is not a licence; the defensible line is the
**rendered** precedent of §4.1. The leak itself is §9.1.

### 4.3 Why two queries rather than a relation

Loading the shipment through `listingsRelations` would make
`src/db/schema/listings.ts` import `shipments.ts`, which already imports
`listings.ts` — a cycle in the schema layer. Drizzle's lazy `relations()`
usually tolerates it. A second batched query, keyed on the listing ids just
read, costs one round trip and no risk, and leaves `getByShipperId` untouched
for its other caller, `/api/users/[id]/listings`.

## 5. Permissions

| Actor | May read a delivery history |
|---|---|
| The requester | Their own, and only their own |
| Anyone else, incl. admin | No — the endpoint takes no user parameter |
| Unauthenticated | 401 |

`getMyListings` receives the shipper id from the session in the route and never
from the query string, exactly as before. The delivery block inherits that
scope: only listings the caller owns are read, so only their shipments are
looked up.

## 6. API

`GET /api/listings/me` — unchanged contract, unchanged `status` filter,
unchanged status codes. Every job may now carry `delivery` (§4).

The history tab requests the list **without** a status filter, so the other
tab's filter can never hide a delivery.

## 7. Screen behaviour

### 7.1 Tabs

`/listings/me` renders both. The active tab lives in the URL — `?tab=history`;
absent or unrecognised means `requests` — written with
`router.replace(..., { scroll: false })`, copied from
`CarrierTripsScreen.tsx:24-33`, so a reload, a back button and a shared link all
land where the requester was. The page needs a `Suspense` boundary because the
screen reads `useSearchParams()`; without one `next build` fails while
`tsc --noEmit` passes.

### 7.2 Demandes

Unchanged: a status `<Select>` over all seven `ListingStatus` values plus *all*,
a **Publier une demande** button, one row per request, `PageLoader` while
loading, `CenteredEmptyState` when empty or filtered to nothing, and an
`isError` branch.

### 7.3 Historique

One card per delivered request, newest delivery first:

- the transporter — avatar, name, rating — as the line the card is *for*;
- the job title, linking to `/deliveries/{shipmentId}`;
- the route, pickup city → dropoff city;
- the delivery date and the price paid;
- a *via Expedion* badge when `origin === "expedion"`;
- a delivery-photo marker when the driver left one.

States:

- loading → `PageLoader`
- error → `CenteredEmptyState`, never a blank page (CLAUDE.md gotcha 9)
- empty → `CenteredEmptyState` saying nothing has been delivered *yet*, which is
  not the same as something having failed

A delivery whose carrier does not resolve renders as an unnamed transporter
rather than disappearing: a delivery that happened is history whether or not the
account behind it still resolves. Same reasoning as the LEFT JOINs in
`earnings.dal.ts:12-15`.

## 8. i18n

New keys under `myJobs`, added to `messages/fr.json` and `messages/en.json` in
the same position and order:

```
myJobs.tabs.requests
myJobs.tabs.history
myJobs.history.empty
myJobs.history.emptyDesc
myJobs.history.loadFailed
myJobs.history.deliveredOn
myJobs.history.carrier
myJobs.history.unknownCarrier
myJobs.history.proof
myJobs.history.count
```

`src/i18n/__tests__/locale-parity.test.ts` fails on a key present in one
catalogue only, and on an empty string in either. It asserts no count — none is
added (CLAUDE.md's "1715 keys" is stale; the real figure is ~2053 leaf paths).

Dates go through `useFormatter().dateTime`. `MyJobs.tsx:156` formatted
`createdAt` with `date-fns` and **no locale**, printing "2 Aug 2026" to a French
reader; that line moves to the same formatter here, so both tabs read correctly
in both languages. A test rendering either tab must pass
`timeZone="Europe/Paris"` to the provider or next-intl calls `onError`.

## 9. Known limitations

1. `GET /api/shipments` still returns the carrier's whole `user` row to a
   shipper (§4.2). This endpoint does not, but the leak on the shipments read
   path is untouched and wants its own fix in `shipment.service.ts`.
2. `shipments.carrierId` is `on delete cascade`, and `usersDal.deleteUser` is a
   hard delete reachable from the `/admin/users` delete action. Deleting a
   carrier therefore **deletes every shipment they carried**, and the
   requester's history entry vanishes rather than surviving as an unnamed row —
   the listing is left at `completed` with no delivery behind it. A history an
   admin action can silently erase is not yet a history. The fix is a
   `carrierName` snapshot on `shipments`, as `impersonation_sessions` already
   keeps for the accounts it outlives; out of scope here, written down so it is
   not rediscovered.
3. `/api/listings/me` has **no output DTO** — the raw Drizzle rows go out and
   `Job` is an unvalidated cast at `listings.api.ts:38`. `delivery` is shaped by
   the service, so it is the one part of the payload that is deliberate. Giving
   the whole payload a schema is a separate change.
4. Neither tab paginates. `getByShipperId` is unbounded today and stays so;
   capping it now would silently drop rows from the existing tab. When a
   requester's list stops being short, the route gains the `{ items, total }`
   envelope `/api/shipments` already uses.
5. Search and period filters, which the carrier's *Effectués* tab has, are not
   here. When they arrive they belong in the query, not in the client.
6. A cancelled request is not in the history — it is in *Demandes*, filtered to
   *Annulée*. The client asked for a history of **delivered** items.

## 10. Test coverage required

- [x] `getMyListings` attaches `delivery` to a listing whose shipment is `DELIVERED`
- [x] It attaches nothing for a shipment in any other status
- [x] A delivered shipment whose listing still reads `in_progress` still gets a
      `delivery` — the shipment is the source of truth
- [x] No listings means the shipment query is never issued
- [x] An unresolved carrier yields `carrier: null`, not a dropped delivery
- [x] A listing carrying two delivered shipments shows the most recent
- [x] `hasProofOfDelivery` reflects whether a delivery photo exists, and no
      object key reaches the payload
- [x] A history card renders the transporter's name
- [x] A delivery with `carrier: null` renders the unknown-transporter label
- [x] The empty state renders, and does not read as an error
- [x] `isError` renders the failure state rather than a blank page
- [x] `?tab=history` opens the history tab; no `tab` opens Demandes
- [x] Both locales render with no `NextIntlClientProvider` `onError`
