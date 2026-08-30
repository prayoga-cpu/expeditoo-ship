# Spec — Offers Engine

**Roadmap ref:** `ROADMAP.md` §8 Phase A · **Plan:** `docs/plans/plan_phase_a_bidding_core.md` WP3

The offers engine is the product. Carriers compete **downward** on price for a
shipper's transport job. The **shipper selects** the winner — never the system,
never the lowest price automatically.

---

## 1. Entity

```ts
offers {
  id                 text pk
  listingId          text not null -> listings.id  on delete cascade
  carrierId          text not null -> user.id      on delete cascade
  vehicleId          text not null -> vehicles.id  on delete restrict
  priceCents         integer not null              // total, TTC, what the shipper pays
  estimatedPickup    timestamp not null            // the *booked* slot, see below
  estimatedDelivery  timestamp not null
  deliveryLeadDays   integer not null default 0    // 0 = the same day, 1 = J+1
  message            text                          // max 1000 chars
  status             offer_status not null default 'pending'
  createdAt          timestamp not null
  updatedAt          timestamp not null
}

offer_slots {
  id           text pk
  offerId      text not null -> offers.id  on delete cascade
  day          text not null                       // YYYY-MM-DD, no timezone
  slot         time_slot not null                  // morning | afternoon | evening
  startsAt     timestamp not null
  endsAt       timestamp not null
  deliveryAt   timestamp not null
}

offer_status = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired'
time_slot    = 'morning' | 'afternoon' | 'evening'
```

**An offer proposes one to twelve time slots, and the award books one.**
`estimatedPickup` / `estimatedDelivery` hold the booked slot — the earliest
proposed while the offer is pending, the chosen one once awarded — which is why
every reader here still reads that pair. Full behaviour, including the derived
delivery deadline and the empty-slot lane used by `takeJob` and `assignDirect`,
is in `docs/specs/offer_time_slots_spec.md`.

**Constraints**

- `UNIQUE (listing_id, carrier_id) WHERE status <> 'withdrawn'` — one live offer per
  carrier per job. A withdrawn offer frees the slot for one replacement.
- Index on `(listing_id, status)`, `(carrier_id, status)`, `(listing_id, price_cents)`.

---

## 2. State machine

```
                 submit
        (none) ─────────► pending
                            │
        withdraw            │            listing awarded to another offer
   pending ──────► withdrawn│                        │
                            ├──── accept ──► accepted (terminal)
                            ├──── reject ──► rejected (terminal)
                            └── listing expires ──► expired (terminal)
```

- `accepted`, `rejected`, `expired` are **terminal**. No transition leaves them.
- `withdrawn` is terminal for that row; the carrier may submit a **new** offer.
- Exactly **one** `accepted` offer may exist per listing. Enforced in a transaction.

---

## 3. Submit an offer

`POST /api/listings/:listingId/offers`

### Authorisation

| Check | Failure |
|---|---|
| Authenticated | `401 UNAUTHENTICATED` |
| Has `carrier` role | `403 FORBIDDEN_NOT_CARRIER` |
| Carrier application `APPROVED` | `403 CARRIER_NOT_APPROVED` |
| Not the listing's own shipper | `403 CANNOT_BID_OWN_LISTING` |
| `vehicleId` belongs to this carrier | `403 VEHICLE_NOT_OWNED` |

### Preconditions

| Check | Failure |
|---|---|
| Listing exists | `404 LISTING_NOT_FOUND` |
| `listing.status === 'open'` | `409 LISTING_NOT_OPEN` |
| `listing.expiresAt` in the future | `409 LISTING_EXPIRED` |
| No live offer from this carrier | `409 OFFER_ALREADY_EXISTS` |

### Input

```ts
{
  vehicleId: string,           // cuid2
  priceCents: number,          // int, 100 ≤ p ≤ 100_000_00
  slots: { day: string, slot: TimeSlot }[],  // 1..12, over at most 4 days
  deliveryLeadDays: number,    // 0..7, default 0
  tzOffset: number,            // the client's getTimezoneOffset()
  message?: string,            // ≤ 1000 chars
}
```

### Validation rules

1. `priceCents` is an **integer** ≥ `100` (1 €) and ≤ `10_000_000` (100 000 €).
   Non-integer → `400 PRICE_NOT_INTEGER`. Out of range → `400 PRICE_OUT_OF_RANGE`.
2. Between 1 and 12 slots over at most 4 distinct days, none repeated → else
   `400 SLOTS_REQUIRED` / `TOO_MANY_SLOTS` / `TOO_MANY_SLOT_DAYS` /
   `SLOT_DUPLICATE`.
3. Every slot's **end** is in the future → else `400 SLOT_IN_PAST`. The end, not
   the start: a driver bidding at 10:00 can still offer this morning.
   `DELIVERY_BEFORE_PICKUP` is gone — the delivery is derived and cannot precede
   the pickup (`offer_time_slots_spec.md` §3.3).
4. **Every** slot must overlap `[listing.pickupFrom, listing.pickupUntil]`
   **unless** `listing.isFlexible` → else `400 PICKUP_OUTSIDE_WINDOW`. Overlap,
   not containment.
5. The vehicle must be able to carry the job:
   `vehicle.maxWeightKg >= listing.weightKg` → else `400 VEHICLE_CAPACITY_WEIGHT`.
   Each of L/W/H, when both sides are set, must fit → else `400 VEHICLE_CAPACITY_DIMENSIONS`.

**Undercutting is not required.** A carrier may bid above `listing.budgetCents` or
above an existing offer. The shipper decides. The UI surfaces the spread; the
service does not police it.

### Effects

- Insert the offer as `pending`.
- `listings.offersCount += 1` in the same transaction.
- Notify the shipper (in-app + email per preferences).
- Publish `offer:created` on Ably channel `listing:{listingId}`. Payload carries
  `offerId`, `priceCents`, carrier display name and rating — **never** the carrier's
  contact details or KYC data.

### Response `201`

The created offer, with the carrier's public profile embedded.

---

## 4. Withdraw an offer

`POST /api/offers/:id/withdraw`

- Only `offer.carrierId === session.user.id` → else `403 FORBIDDEN`.
- Only from `pending` → else `409 OFFER_NOT_PENDING`.
- Sets `withdrawn`, decrements `listings.offersCount`, publishes `offer:withdrawn`.
- A carrier may then submit one replacement offer (the unique index permits it).

---

## 5. Accept an offer — the critical path

`POST /api/offers/:id/accept` — body `{ slotId?: string }`, and an absent body
is valid.

This is the money path. It must be **atomic** and **idempotent**.

`slotId` names which of the carrier's proposed slots is being booked; absent
means the earliest, which the offer's stored pair already holds. A `slotId` that
is not on this offer is `400 SLOT_NOT_ON_OFFER`.

### Authorisation

- Only `listing.shipperId === session.user.id` → else `403 FORBIDDEN_NOT_SHIPPER`.

### Preconditions

| Check | Failure |
|---|---|
| `offer.status === 'pending'` | `409 OFFER_NOT_PENDING` |
| `listing.status === 'open'` | `409 LISTING_NOT_OPEN` |
| Listing has no `acceptedOfferId` | `409 LISTING_ALREADY_AWARDED` |
| Shipper has a valid payment method | `402 PAYMENT_METHOD_REQUIRED` |

### Transaction

All of the following commit together or none do:

1. Re-read the listing `FOR UPDATE`. Re-check `status === 'open'` and
   `acceptedOfferId IS NULL` **inside** the lock — this is what prevents two
   concurrent accepts from both winning.
1b. If a slot was named, `offer.estimatedPickup` / `estimatedDelivery` are
   rewritten to it, so step 5 schedules the shipment from the booked slot.
2. `offer.status = 'accepted'`.
3. All other `pending` offers on the listing → `rejected`.
4. `listing.status = 'awarded'`, `listing.acceptedOfferId = offer.id`.
5. Create the `shipment`: `listingId`, `offerId`, `carrierId = offer.carrierId`,
   `shipperId = listing.shipperId`, `status = 'PENDING'`, pickup/dropoff copied
   from the listing, `priceCents = offer.priceCents`.
6. Create the `payment` row: `amountCents = offer.priceCents`,
   `commissionCents = round(offer.priceCents * COMMISSION_RATE)`,
   `status = 'authorising'`. The rate is 1.0 during the testing phase — see
   `payments.service.ts`, and ROADMAP.md §10.
7. Open the `conversation` between shipper and carrier if none exists.

### After commit

8. Authorise the Stripe PaymentIntent (manual capture — money is **held**, not taken;
   `ROADMAP.md` §1 "Stripe holds and releases payment").
   - On Stripe failure: compensate by reverting steps 2–6 and returning
     `402 PAYMENT_AUTHORISATION_FAILED`. The listing returns to `open` and offers
     return to `pending`. This compensation must be logged.
9. Notify: winner (`offer_accepted`), each loser (`offer_rejected`), both parties
   (`shipment_created`).
10. Publish `listing:awarded` on `listing:{listingId}`.

### Idempotency

Re-POSTing accept on an already-`accepted` offer returns `200` with the existing
shipment, **not** `409` and **not** a second shipment. Keyed on `offer.id`.

### Response `200`

`{ offer, shipment, payment: { status, clientSecret? } }`

---

## 6. Reading offers

`GET /api/listings/:listingId/offers`

Visibility differs by viewer — this matters, and is easy to get wrong:

| Viewer | Sees |
|---|---|
| The listing's shipper | **All** offers, full detail, sorted per `?sort=` |
| A carrier | **Only their own** offer on this listing |
| Anyone else (incl. anonymous) | Aggregate only: `offersCount`, `lowestPriceCents` |
| `admin` / `operator` | All offers, full detail |

Sort options: `price_asc` (default), `price_desc`, `rating_desc`, `pickup_asc`,
`created_desc`.

`GET /api/carrier/offers?status=` — the authenticated carrier's own offers across
all listings, for the "my offers" screen.

---

## 7. Expiry

When a listing passes `expiresAt` with no accepted offer (cron, per
`docs/specs/cron_spec.md`):

- `listing.status = 'expired'`; every `pending` offer → `expired`.
- Notify the shipper ("no carrier selected") and each bidding carrier.
- No payment is touched — nothing was ever authorised.

---

## 8. Edge cases

| # | Case | Behaviour |
|---|---|---|
| 1 | Two shippers accept two offers concurrently | Row lock in §5.1; the loser gets `409 LISTING_ALREADY_AWARDED` |
| 2 | Carrier withdraws while the shipper is accepting | Accept holds the lock; withdraw waits and then fails `409 OFFER_NOT_PENDING` |
| 3 | Carrier's approval is revoked after bidding | Existing offers stay valid; the carrier cannot submit new ones. Accepting a revoked carrier's offer → `409 CARRIER_NO_LONGER_APPROVED` |
| 4 | Listing edited after offers exist | Material edits (weight, dimensions, pickup window, addresses) invalidate all pending offers → `expired`, carriers notified to re-bid. Title/description edits do not |
| 5 | Carrier deletes the vehicle used in a live offer | `ON DELETE RESTRICT` — deletion is blocked while a live offer references it |
| 6 | Shipper cancels a listing with pending offers | Listing → `cancelled`, offers → `rejected`, carriers notified |
| 7 | Offer price above the shipper's budget | Allowed. Flagged in the UI as over budget, not rejected |
| 8 | Zero offers when the window closes | §7 expiry. Shipper is prompted to repost with a longer window or higher budget |
| 9 | Carrier bids on an `expedion`-origin listing | Identical in every respect — `ROADMAP.md` §3, "everything downstream is identical" |

---

## 9. Test coverage required

`src/server/services/__tests__/offers.service.test.ts` must assert:

- Each authorisation failure in §3 and §5.
- Each validation rule in §3, both sides of every boundary.
- The full accept transaction: winner accepted, all others rejected, listing
  awarded, shipment created, payment row created, commission at the configured
  rate (100% during the testing phase).
- Concurrent accept — only one wins (edge case 1).
- Accept idempotency (§5).
- Stripe-failure compensation restores `open` + `pending` (§5.8).
- Visibility matrix in §6 for all four viewer classes.
