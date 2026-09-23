# Spec: beta data seed (`pnpm db:seed:beta` / Actions → "Seed beta data")

## 1. Purpose

Put one transaction on every role's side of the platform for a single
**owner** account, so a beta tester signed in as that account finds something
real on every screen. "Real" is the point: every row is produced by the
service the product itself calls, so it carries the event log, the document
number, the notification and the review aggregate a genuine transaction
would.

## 2. Actors

| Name | Env | Default | Role in the seed |
|---|---|---|---|
| owner | `BETA_OWNER_EMAIL` | `prayogadevelopment@gmail.com` | every side is seeded around them; row never modified except by the roles a real approval grants |
| shipper | `BETA_SHIPPER_EMAIL` | `prayogadevelopment+expeditootest@gmail.com` | posts the two jobs the owner drives |
| carrier | `BETA_CARRIER_EMAIL` | `prayogadevelopment+expeditoocarrier2@gmail.com` | drives the job the owner posts, bids on the rest |
| system | `BETA_SYSTEM_EMAIL` | `system+expedion@expeditoo.com` | owns the escalated Expedion job; optional |

The seed **never creates a person**. A missing owner, shipper or carrier is a
hard error naming the email; a missing system account only skips §4.6.

## 3. Target gate

- `POSTGRES_URL` is normalised (`normaliseConnectionString`) and written back
  before `@/db` is imported, because `@/db` reads it raw.
- `SEED_TARGET=production` **and** `APP_ENV=production` are both required to
  touch production; either alone is an error. Without `SEED_TARGET`, the
  target must pass `assertDevelopmentDatabase`.
- `MOCK_PAYMENTS` must be `"true"`, or the run refuses before connecting: an
  award through the real Stripe path would either charge a card or throw
  `PAYMENT_METHOD_REQUIRED` and unwind.

## 4. What is written, in order

### 4.1 Counterparties
`user.email_verified = true` for shipper and carrier if false. Nothing else on
`user`. The owner's row is not touched.

### 4.2 Fleet
For owner and carrier: a `carriers` row (`status: submitted`, fixed id, fixed
Luhn-valid SIRET), then **`carrierService.approve(owner.id, carrier.id)`** —
the real approval — which sets `approved_at`/`approved_by = owner`, accepts
documents, and grants `carrier` + `driver` plus the `carrier_drivers`
self-link (TESTING_MOCKS.md §4). One `vehicles` row each (owner: `van`,
carrier: `truck_20m3`), inserted `ON CONFLICT DO NOTHING`.

### 4.3 Trajets
One `carrier_routes` each through `carrierRoutesService.create`: owner
recurring Paris → Lyon (Mon/Wed/Fri, discoverable), carrier occasional
Lyon → Marseille (two dates). Keyed on `label`.

### 4.4 Jobs (`listingsService.createListing`, `notifyRouteMatches: false`)
| Key | Shipper | Then |
|---|---|---|
| `completed` | shipper | owner bids → shipper awards → owner walks to `DELIVERED` → backdated → two reviews |
| `driverRun` | shipper | owner bids → shipper awards → left `PENDING` |
| `shipperRun` | owner | carrier bids → owner awards → left `PENDING` → thread with two messages |
| `awaitingChoice` | owner | carrier bids → left `open` |
| `draft` | owner | `publish: false` |

Keyed on `(shipper_id, title)`; the title carries `BETA · `.
**`notifyRouteMatches: false` is mandatory** — the fan-out queries every real
`carrier_routes` row and notifies every matching carrier.

### 4.5 Bids and awards
`offersService.submitOffer` with one `morning` slot on the job's pickup day,
`deliveryLeadDays: 1`, `tzOffset: -120`. `offersService.acceptOffer` by the
shipper. Under `MOCK_PAYMENTS` the charge is a `pi_mock_<shipmentId>`
`captured` row (source `stripe`), which **raises a receipt from the real
`INV` sequence** — three awards, three numbers, permanently consumed. Every
one of those documents prints the mock line, never PAYÉ.

### 4.6 Award queue
An `expedion_quotes` row (`escalated`, `paid`, fixed id) and, through
`listingsDal.create`, its listing (`origin: expedion`, `external_ref` =
quote id, owned by the system account), then two bids. Left open.

### 4.7 The delivered run
`shipmentService.updateStatus` PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT →
DELIVERED as the owner. Before PICKED_UP and DELIVERED a placeholder
`shipment_photos` row (`object_key beta/…`, no object) satisfies the gate;
all placeholders are soft-deleted right after with a stated reason, so the
live filter hides them. DELIVERED runs the product's own settlement:
`listings.status = completed`, `payouts` scheduled for the owner. Then dates
are shifted so pickup reads six days ago and delivery five (listing windows,
offer, slot, shipment, payment, invoice, payout, events) — only on the run
that created the award, never on a re-run.

## 5. Idempotency
Fixed ids where this script mints them; `(shipper, title)` / `(listing,
carrier)` / `label` lookups where a service mints them. A second run repairs
a partial first run and creates nothing new. Backdating is skipped once
`listing.pickup_from` is in the past.

## 6. Never
- Stripe, Resend, Twilio, Ably, R2: no key is present; `sendViaResend` is
  never reached (`email.service` mocks without a key), SMS returns
  `TWILIO_NOT_CONFIGURED`, Ably publishes are caught, no object is uploaded.
- Route-match alerts (§4.4).
- Creating or deleting a `user`, changing a password.
- Raw SQL — every write is Drizzle through a DAL or `db.update` on a column
  the seed itself made true.

## 7. Errors
Any thrown `ListingError` / `OfferError` / `ShipmentError` aborts the run with
its `code`; the run is safe to repeat. `ALREADY_REVIEWED` is the one code
swallowed, on re-run.

## 8. Test coverage required
- [x] both SIRETs pass Luhn; a tampered one fails
- [x] every listing fixture parses through `createListingSchema`, is in the
      future, windows ordered, coordinates present
- [x] offer fixture: one slot on the pickup day
- [x] route fixtures: recurring/occasional shape rules
- [x] Expedion row: `origin`, `external_ref`, `expires_at = pickup − 6 h`
- [x] placeholder photo key is recognisable
- [ ] the runner itself is exercised against the local database before every
      production dispatch, and its console summary read
