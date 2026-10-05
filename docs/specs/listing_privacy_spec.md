# Spec — who may read what of a request

**Plan:** `docs/plans/plan_listing_privacy.md` · **Release:** 2.60.0

**Found** while closing 2.59.0 and approved by the owner (2026-10-05, "Data +
vetted addresses"): `GET /api/listings` and `GET /api/listings/:id` needed no
session and returned the raw listing row — street addresses, exact
coordinates, the contacts' names and phones, the access notes (door codes) —
with `shipper: true`, the requester's **whole `user` row**: email, Stripe
customer and account ids, preferences, `lastLoginAt`. An escalated job carries
the Expedion buyer's home address and phone the same way. `GET
/api/users/:id/listings` did the same, and a requester reading the bids on
their job received each bidding carrier's whole `user` row and plate number.

The product's own pages already promised the fix: « Les adresses complètes se
débloquent une fois vérifié » and « Une course est un lien : envoyez-la à un
collègue, il la voit sans compte ».

## 1. Audiences

`listingAudience(listing, viewer)` (`src/server/services/listing-view.ts`):

| Audience | Who | Reads |
|---|---|---|
| `full` | the request's owner; staff (`admin`, `operator`) | every classified column |
| `vetted` | an **approved** carrier (`carriers.status = 'approved'`) | `public` + street addresses + exact coordinates |
| `public` | everyone else, signed in or not | the job without where exactly or who: city, postal code, location type, floor and lift, coordinates **rounded to 2 decimals** (≈ 1 km) |

Contact names and phones and the access notes are **never** in a listing for
anyone but `full`. The awarded carrier and their driver read them from the
shipment, which copies them at award (`offers.service.ts`, `shipments.ts`).

**A filter never answers more precisely than the view.** The rounding is one
function, `roundCoordinate` in `src/lib/listing-coordinates.ts`
(`floor(value × 100 + 0.5) / 100`), and the board's location filters apply it
too (§3). Rounded on the card but searched on the exact pin, a radius search
is an oracle: each request asks "is the pin within r km of here?", and about
120 of them put an exact pin back to within a metre — for an escalated job the
dropoff is the Expedion buyer's home.

## 2. The allow-list

Every column of `listings` is classified exactly once in `listing-view.ts`:
`PUBLIC_LISTING_FIELDS`, `VETTED_LISTING_FIELDS` (the two street addresses),
`COORDINATE_FIELDS` (exact or rounded), `PRIVATE_LISTING_FIELDS` (`full` only:
contacts, notes, `externalRef`, `acceptedOfferId`, `scheduledPublishAt`). The
projection keeps listed keys and drops everything else, so a new column is
private until someone classifies it — and the test in §5 fails until they do.

Relations are projected too:
- `shipper` → `{id, name, image, rating}` for every audience — staff read the
  requester's email through the admin endpoints, which are not these;
- `photos` → `{id, url, order}`; `category` → `{id, name, slug}`.

`delivery` is not a listing column and the projection does not carry it:
`getMyListings` projects each of the owner's rows through `full` and attaches
the delivery afterwards, already narrowed by `toDelivery` (the carrier as
`{id, name, image, rating}`, the photos as a flag).

## 3. Routes

| Route | Session | Projection |
|---|---|---|
| `GET /api/listings` (the board) | **required** (401) — every caller was already signed in | per item: `full` for the viewer's own requests, else `vetted` or `public`. The location filters — radius, corridor, étapes, the direction test and the `distance_asc` sort — run on the exact pins for staff and approved carriers only; for everyone else on the pins rounded as the `public` view rounds them (§1), a requester included |
| `GET /api/listings/:id` | optional — a job stays a shareable link | per viewer |
| `GET /api/listings/me` (and its alias `GET /api/users/me/listings`) | **required** | the caller's own rows, so `full`, plus `delivery` (§2) — through the allow-list, never the DAL rows whole |
| `GET /api/users/:id/listings` | **required**; now through `listingsService.getOpenListingsOf` instead of the DAL | per item |
| `GET /api/listings/:id/offers` (`full` scope: owner, staff) | unchanged | each bid's `carrier` → `{id, name, image, rating}`; `vehicle` → `{id, type, make, model, maxWeightKg, maxLengthCm, maxWidthCm, maxHeightCm}`, no plate |
| `GET /api/carrier/offers` | unchanged | each bid's `listing` → `vetted` (the carrier is approved; contacts come with the shipment) |
| `POST /api/offers/:id/accept`, `POST /api/listings/:id/take` | unchanged | `{ offer, shipment: { id }, alreadyAccepted }` — the offer's own columns with no relation beside it, the repeat of an accept included. Never the rival bids the award rejected, the payment row, the carrier's `user` row or the plate (`offers_engine_spec.md` §5) |
| `GET /api/shipments`, `GET /api/shipments/:id` | unchanged | for the requester and the carrier, `shipper`, `carrier` and `driver` → `{id, name, image}`, and `listing` through this projection — `full` for the requester, `vetted` for the carrier, who reads the contacts and notes from the shipment's own copied columns; staff unchanged; drivers as before (`redactForDriver`) |
| `POST /api/shipments/:id/cancel`, `POST /api/shipments/:id/withdraw` | unchanged | `{ shipment: { id }, listingId, alreadyCancelled }`, a repeat included — never the shipment graph (`cancellations_spec.md` §8.2) |

The admin listing endpoints (`/api/admin/listings`) are staff-only and keep
the requester's email.

## 4. Screens

- `JobDetail` → `Endpoint`: no street line → « Adresse exacte communiquée aux
  transporteurs vérifiés. » / "Exact address shared with verified carriers."
- `JobDetail` gains an error state (CLAUDE.md gotcha 9): a 404 used to spin
  forever.
- The client `Job` type makes the street addresses optional and declares the
  owner-only fields as optional — `acceptedOfferId` and `scheduledPublishAt`
  included. `AcceptOfferResult.offer` is the offer without `carrier`,
  `vehicle` or `slots`.

## 5. Test coverage required

- `src/server/services/__tests__/listing-view.test.ts`:
  - every column of `listings` (`getTableColumns`) is classified exactly once;
  - the `public` view has exactly the public keys plus rounded coordinates, no
    street, no contacts, no notes, no `externalRef`; the `vetted` view adds the
    streets and exact coordinates and nothing else; `full` has the private
    fields;
  - `shipper` has exactly `id, name, image, rating`, and the serialised view of
    a fixture holding a full `user` row contains none of its email, Stripe ids
    or preferences;
  - audience resolution: owner, staff, approved carrier, pending carrier,
    signed out;
  - `searchesExactLocation`: staff and approved carriers only.
- `src/lib/__tests__/listing-coordinates.test.ts`: `roundCoordinate` keeps two
  decimals and agrees, on the wire, with the `Math.round(v × 100) / 100` the
  card used before — across mainland France and on halves either side of zero.
- `src/server/dal/__tests__/listings-browse.dal.test.ts` (rendered SQL): without
  `exactLocation` — the default — every read of a pin column in a radius
  search, a corridor search (both ends and the direction test) and the
  distance sort sits inside `floor(… * 100 + 0.5) / 100`, with the scale
  `COORDINATE_SCALE`; with it, none does.
- `listings.service.test.ts`: `browse` and `getListing` hand each audience its
  view — a stranger, a signed-out visitor, an approved carrier (streets and
  exact pins, no contacts), staff and the owner (everything); `browse` returns
  the viewer's own request in full beside someone else's in `public`, and
  asks the DAL for exact pins for staff and approved carriers only; drafts and
  scheduled requests are still 404 for others; `getMyListings` drops a key
  nobody classified and projects the photos.
- `offers.service.test.ts`: the requester's bid list carries no carrier email
  and no plate; a carrier's own list carries no contacts; the accept answer
  (fresh and repeat) and the take answer hold exactly `offer`, `shipment` and
  `alreadyAccepted` — no rival's id, vehicle, price or message, no payment
  row, no carrier email, Stripe id or plate.
- `shipment.service` test: the requester and the carrier see each other as
  `{id, name, image}`; the carrier's `listing` has no contacts, notes,
  `externalRef` or `acceptedOfferId` (the shipment's own contact columns
  stay), the requester's has them, staff's is untouched.
- `shipment-cancellation.service.test.ts`: cancel and withdraw answer
  `{ shipment: { id }, listingId, alreadyCancelled }`, first call and repeat,
  and never read the shipment graph.
- `JobDetail.test.tsx`: the city-only endpoint renders its note; an error shows
  a message.
