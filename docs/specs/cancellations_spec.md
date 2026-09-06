# Specification: Cancellations from both sides

**Plan:** `docs/plans/plan_cancellations.md`
**Related:** `docs/specs/offers_engine_spec.md`, `docs/specs/payment_at_booking_spec.md`,
`docs/specs/incident_reporting_spec.md`, `docs/specs/expedion_post_payment_fork_spec.md`
**Date:** 2026-09-05

**Supersedes** `docs/specs/shipment_spec.md` §6, which is v1 and describes a
`PRICE_PROPOSED` status that is not in `shipmentStatusEnum`.

---

## 1. Overview

A transport job can stop for two completely different reasons, and until now the
code could not tell them apart.

**The requester calls the job off.** They no longer need the transport. The job
is over: the listing dies, the bids die, the money goes back.

**The transporter backs out.** Their van is dead, their driver is ill, the cargo
is not what the job described. The job is *not* over — the client still wants it
and has already paid for it. It goes back on the board and someone else takes it.

Today both press the same button and get the first outcome. A driver dropping a
job destroys a paid client's delivery, silently, with no way back.

```
                       ┌─────────────────┐
   requester  ────────▶│                 │──▶ listing cancelled, bids expired
   operator            │  cancelJob      │    money refunded
                       │                 │    quote → cancelled
                       └─────────────────┘

                       ┌─────────────────┐
   transporter ───────▶│                 │──▶ listing back to open, window re-armed
   (the winner)        │  withdrawFromJob│    rival bids restored to pending
   operator            │                 │    money refunded
                       └─────────────────┘    quote → escalated, carrier cleared
```

### 1.1 Who the requester is, per inlet

`listings.origin` decides, and it is stamped by the service — never accepted
from a client.

| Inlet | The requester is | Reaches the app as |
|---|---|---|
| `direct` | whoever posted at `/create` (`listing.shipperId`) | a session; `partyFor` → `shipper` |
| `expedion` | the quote owner (`expedion_quotes.firebase_uid`) | **no `user` row at all** |

On an escalated job `listing.shipperId` is the Expedion system account that
nobody signs into. It is therefore **never** treated as the requester: an
operator or admin acting there is `operator`, and a session that resolves to the
system account with no operator role is refused (§5.4).

The escalated requester cancels through `POST /api/expedion/quotes/:id/cancel`,
authorised the way that inlet already authorises the confirmation route — through
`expedionService.getQuote`, which answers **404, not 403**, to a non-owner.

### 1.2 Why nobody approves a pre-pickup withdrawal

A withdrawal is unilateral before pickup. A driver with a dead van at 06:00 who
must wait for an operator to click *approve* is a job that dies during the only
hours it could still be re-sold. Accountability is the record — side, category,
actor, timestamp — not a gate.

After pickup the calculus inverts (§5.5): the goods are in a vehicle and nobody
ends someone else's transport alone.

---

## 2. User stories

1. As a **transporter** who cannot run a job I won, I hand it back before pickup,
   say why, and the client's job returns to the board rather than dying.
2. As a **requester** who no longer needs the transport, I call it off before
   pickup and am refunded.
3. As an **Expedion client**, I cancel from my own app, and Expedion is told a
   refund is owed.
4. As a **client**, when my transporter backs out I am told *that*, not that my
   transport is cancelled.
5. As a **carrier** whose bid was rejected, I am told when the job comes back.
6. As an **operator**, I can end a run that is already on the road — which the
   product has claimed since day one and has never been able to do.
7. As anyone reading the record afterwards, I can see **which side** cancelled
   and **why**, from the shipment row alone.

---

## 3. Data model

One hand-written migration: `src/db/migrations/0021_cancellations.sql`, plus its
`meta/_journal.json` entry with a `when` strictly greater than the current tail.
(0019 and 0020 were taken by concurrent work while this was being written — the
tail is re-read at write time for exactly that reason, and a `when` that is not
strictly increasing is skipped by drizzle in silence.) `pnpm db:generate` is
banned in this repo.

### 3.1 `shipment_cancellation_side` (new enum)

```
requester | transporter | operator
```

Deliberately not `actor_role`. `carrier` and `driver` are one commercial side;
`shipper` and the accountless Expedion quote owner are the other; `operator` and
`admin` are the third. The money and listing rules key on the **side**, so the
side is what is stored. `shipment_events.actor_role` cannot stand in: it is a
separate, non-transactional insert, and `recordEvent` collapses `staff → admin`.

### 3.2 `shipment_cancellation_category` (new enum)

Eleven values in one enum, fenced **per side by the Zod schema** rather than by
three columns, so a report can `group by cancellation_category` with no join.

| Side | Values |
|---|---|
| transporter | `vehicle_breakdown`, `driver_unavailable`, `cargo_mismatch`, `access_impossible` |
| requester | `no_longer_needed`, `date_changed`, `arranged_elsewhere` |
| operator | `no_driver_found`, `fraud_or_abuse`, `support_resolution` |
| any | `other` |

`cargo_mismatch` and `access_impossible` are named because they are the two
common cases where the transporter presses the button but the *cause* is the
client's description or the pickup site. A future reliability count must not
charge those to the driver.

### 3.3 Columns on `shipments`

```
cancelled_by_side       shipment_cancellation_side       null
cancellation_category   shipment_cancellation_category   null
cancelled_by_user_id    text  → "user"(id) on delete set null
cancelled_by_ref        text                             null
```

`cancelled_at` and `cancellation_reason` are unchanged and keep being written.
The identity pair copies `shipment_confirmations.confirmed_by_user_id` /
`confirmed_by_ref` verbatim and for the same stated reason: most Expedion clients
have no `user` row, so a foreign key alone cannot record who asked.

### 3.4 `listings.reopened_at` (new column)

`timestamp`, nullable. Stamped by `reopenForRebid`. A job another transporter
dropped is not the job that was posted — its bidding window has been machine-
extended and possibly its pickup window too. Without a marker that job is
indistinguishable from one posted that way, and a bidder is entitled to know.

### 3.5 Deliberately unchanged

- **No `offer_status` value.** A withdrawn winner lands on the existing
  `withdrawn`, which is exact ("the carrier withdrew their offer") and is the one
  value `offer_one_live_per_carrier` excludes — so a driver whose van is fixed by
  noon may bid on the re-boarded job again. A new value would need a migration
  plus four hand-written restatements.
- **No `listing_status` value.** A re-boarded job is `open`; that is what "back
  on the board" means.
- **No `expedion_quote_status` value and no change to its `TRANSITIONS`.**
  `assigned → escalated`, `paid → cancelled`, `assigned → cancelled`,
  `escalated → cancelled` and `picked_up → cancelled` are all already legal.
  Nothing here needs the matrix loosened, and loosening it would open the rewind
  hole `expedion.service.ts` argues against for every caller of `adminUpdate`.
- **No fee, retained-cents or strike column.** §10.1.
- **No cancellation-request table.** §5.5.

---

## 4. The two verbs

### 4.1 `cancelJob` — the job is off

| | |
|---|---|
| Callers | requester (`shipper` party on a `direct` listing; quote owner on `expedion`), `operator`, `admin` |
| Statuses | `PENDING`, `ASSIGNED` for a requester; those plus `PICKED_UP` and `IN_TRANSIT` for staff |
| Shipment | → `CANCELLED`, with side, category, reason, actor |
| Listing | → `cancelled`, `accepted_offer_id` → `NULL`, winning offer → `rejected`, pending offers → `expired` |
| Money | refunded (§6) |
| Expedion | quote → `cancelled` + refund-owed event + SMS |
| Told | carrier, driver, and the requester when staff acted |

### 4.2 `withdrawFromJob` — this transporter is off

| | |
|---|---|
| Callers | `carrier` (the winner), `operator`, `admin`. **Not `driver`** |
| Statuses | `PENDING`, `ASSIGNED` only |
| Shipment | → `CANCELLED`, side `transporter` (or `operator`) |
| Listing | → `open`, re-armed (§4.3), `accepted_offer_id` → `NULL`, `reopened_at` stamped |
| Offers | winner → `withdrawn`; every offer this award had `rejected` → `pending` |
| Money | refunded (§6) |
| Expedion | quote → `escalated`, carrier cleared, `assigned_directly` → false, SMS |
| Told | the requester, the restored rivals, operators, the withdrawing carrier |

**A job can now carry more than one shipment.** Until withdrawal existed a
listing had exactly one — an award created it and cancelling killed the job with
it — so `shipmentsDal.getByListingId` was an unordered `findFirst` over a
non-unique index. It now returns the **live** run, falling back to a cancelled
one only when there is nothing else. Every caller wants that: a confirmation or
a photo lookup on a re-awarded job must reach the run that is happening.

An employed **driver** is refused with `FORBIDDEN_DRIVER_CANNOT_WITHDRAW`: the
award belongs to their carrier and they must not be able to destroy it. A driver
who cannot run the job files an incident and the carrier nominates another —
`assignDriver` already overwrites `driver_id`, so no new verb is needed. A solo
driver is their own carrier (`carriers` is person-level) and resolves to
`carrier`, so this refusal does not reach them.

### 4.3 Re-arming a re-boarded listing

**Without this the feature ships broken.** `listingsDal.findExpired` selects
exactly `{ status: 'open', expires_at < now }` and the sweep runs every fifteen
minutes; `expires_at` is `pickup_from − 6 h` and is therefore already in the past
by the time anything is awarded. A listing handed back to `open` untouched is
invisible on the board (`browse` requires `expires_at >= now`), unbiddable
(`LISTING_EXPIRED`), and expired by the cron — along with every bid just
restored — inside fifteen minutes.

`reopenForRebid` therefore, in the same transaction:

1. Takes `listingsDal.getByIdForUpdate` on the listing. `commitAward`'s three
   in-lock re-checks are the entire concurrency guarantee; a cancellation write
   that skips the lock can interleave with an accept that is mid-flight.
2. Recomputes `expires_at`, and demands a **usable** window, not merely a
   future one: an expiry less than `MIN_BIDDING_WINDOW_MS` away is treated the
   same as none at all. Without that floor a job collecting six hours from now
   goes back on the board with a five-minute bidding window and is swept away —
   with every bid just restored — before anyone can use either.
3. If that throws `PICKUP_TOO_SOON` — the original pickup window has passed or is
   within the 30-minute floor — the whole window slides forward by
   `REBOARD_LEAD_MS` (24 h), preserving each window's duration:
   `pickup_from`, `pickup_until`, `dropoff_from`, `dropoff_until`.
4. Stamps `reopened_at`.

A restored bid whose slots are now in the past is left alone — rewriting a
carrier's proposed times on their behalf would be worse than making them re-bid.
`acceptOffer` therefore gained an **accept-time** `SLOT_IN_PAST` refusal: the
existing one is a submit-time DTO rule, which was enough only while an offer
could be accepted within its own window or not at all. Restoring bids onto a
listing whose window has moved is what makes a past slot reachable from the
award queue, where booking it would write a past `scheduled_pickup` and report a
past pickup date to the client.

---

## 5. Permissions

`partyFor` resolves `shipper → carrier → driver → staff`, in that order, and
that order is not changed here — `EXECUTING_PARTIES` and the photos service
share the module. The **side** is derived from the party *and the inlet*:

```
sideFor(party, origin):
  shipper  + direct    → requester
  shipper  + expedion  → operator      (the system account; requires a real role)
  carrier | driver     → transporter
  staff                → operator
```

### 5.1 Requester, before pickup

Allowed. `PENDING` and `ASSIGNED`. Refused at `PICKED_UP` / `IN_TRANSIT` with
`CANCEL_REQUIRES_SUPPORT` (409) — unchanged, and the client already switches on
that code.

### 5.2 Transporter, before pickup

Allowed to **withdraw**, not to cancel. `carrier` only. A `carrier` calling
`cancelJob` is refused with `USE_WITHDRAW_ENDPOINT` (409): a transporter must not
be able to end a client's paid job, and the refusal names the verb that works.

### 5.3 Operator / admin

Both verbs, every status up to and including `IN_TRANSIT`. `revokeAward` keeps
its URL and its `FORBIDDEN_NOT_OPERATOR` and delegates to `withdrawFromJob`, so
the re-board path exists exactly once.

### 5.4 The Expedion system account

A session that resolves to `shipper` on an `expedion`-origin listing — which is
the system account, and which an admin *can* impersonate — is refused with
`CANCEL_SYSTEM_ACCOUNT_FORBIDDEN` (403) unless it also holds `operator` or
`admin`. Without this, a borrowed session is one click from cancelling a real
client's paid job and having it audited as the machine.

### 5.5 After pickup

Neither side may act alone. Both receive `CANCEL_REQUIRES_SUPPORT`, and the
existing incident lane — `vehicle`, `access`, `safety`, `cargo_mismatch` — is how
either reaches an operator. No new request table and no new queue: an incident
already notifies every operator and admin, already opens a support thread, and
already carries the invariant this needs, that **an incident is a report, not a
lever**. Nothing in this feature gives it one.

The staff lane is fixed to actually work. `TRANSITIONS.IN_TRANSIT` gains
`CANCELLED`; today it holds only `DELIVERED`, so an operator taking the
support carve-out receives `INVALID_STATUS_TRANSITION` four lines later while the
UI copy promises support can help. That is safe only because §7 simultaneously
removes `CANCELLED` from `updateStatus`.

### 5.6 Delivered

Refused for everyone, unconditionally. `DELIVERED: []` keeps no outgoing edge.
This is load-bearing, not incidental: `settleDelivery` has already written a
payout row and an invoice, and **there is no clawback anywhere** — nothing writes
`payout_status = 'cancelled'` or `invoice_status = 'void'` though both values
exist, and `withdrawalsDal.availableFor` counts a `scheduled` payout as
withdrawable regardless of the payment behind it. A post-delivery reversal stays
an admin refund, and §10.3 records the gap.

---

## 6. Money

Both verbs refund. **Nobody holds a client's money for a job that has no
driver** — not the platform between a withdrawal and the next award, and not for
a job that was called off.

### 6.1 `refundForJob(listingId)`

Replaces `refundForShipment(shipmentId)`. The listing is the correct key: after a
withdrawal the shipment is dead, and a refund keyed on it would miss a payment
that is still the client's money. It finds the `captured` payment for the listing
and refunds it in full.

- `source = 'stripe'` → a real `stripe.refunds.create`, then `status = 'refunded'`,
  `refunded_at` stamped. A `pi_mock_` intent skips Stripe and moves only the row.
- `source = 'expedion'` → throws `REFUND_NOT_LOCAL` (409). Expected, not an error.
  That money went into Expedion's Stripe account; this app holds a record of it,
  not the money.
- Not `captured` → returns the row untouched. Marking it `refunded` would put a
  refund in front of an operator that never happened.

### 6.2 A cancellation must never fail on money

The call stays wrapped, as it is today and for the reason recorded in
`payment_at_booking_spec.md`: refusing to record that a job is off because Stripe
was briefly unreachable leaves a job nobody is doing marked live. The swallow is
**narrowed**:

- `REFUND_NOT_LOCAL` is caught **by name** and becomes the refund-owed record
  (§6.3).
- Anything else is logged **and stamped on the cancellation event's metadata as
  `refundFailed: true`**, so a dead Stripe call is visible to support rather than
  living only in a server log.

### 6.3 Refund owed, on the Expedion lane

Copying `cancelAndRequote`: the Stripe Checkout handle is recovered with
`findPaymentReference`, and a quote timeline event records
`{ refundedCents, paymentReference, refundIssued: false }`. `payment_status`
stays `paid` — it becomes `refunded` only when a human confirms the money moved,
and nothing in this app can know that.

### 6.4 No second charge on a re-award

`recordExternalCharge` becomes idempotent **per listing**, not per shipment.
Award → withdraw → re-award mints a new shipment each time, so the per-shipment
key would write a second `captured` `expedion` row for one quote and inflate
recorded revenue by the price of the job. A captured `expedion` row for the
listing is re-pointed at the new shipment instead.

The `stripe` lane is untouched: that client really was refunded and really is
charged again.

### 6.5 Branch on `payments.source`, never on `listings.origin`

They agree today. They are not the same fact — one says where the job came from,
the other where the money moved — and a reader who conflates them will one day
refund the wrong Stripe account.

---

## 7. Closing the back door

`PATCH /api/shipments/:id/status` accepts `"CANCELLED"` today and reaches
`updateStatus`, which sets `cancelled_at` but **no reason, no refund, no listing
close, and no side** — and works from `PICKED_UP`, where the cancel endpoint
refuses. `DriverShipmentStatus` already includes the value, so a driver-side
button wired to the wrong endpoint was one line away.

Three layers, in the same change:

1. `"CANCELLED"` comes out of the route's body enum.
2. `updateStatus` throws `CANCEL_VIA_CANCEL_ENDPOINT` (409) if it is asked for it.
3. The driver client type splits: `DriverShipmentStatus` (what can be read) stays
   as it is; a new `DriverStatusMove` (what can be written) omits `CANCELLED`.

`shipment-photo-gate.test.ts`'s *"never blocks a cancellation"* and
`shipment.service.test.ts`'s `move("PENDING", "CANCELLED")` both drive this path
and are rewritten to drive the cancellation service — deliberately, not
incidentally. The photo gate's actual invariant is unchanged and is re-asserted
there: **a job being called off is the last thing that should demand a photograph
first.**

---

## 8. API

| Method | Path | Who | Body |
|---|---|---|---|
| `POST` | `/api/shipments/:id/cancel` | requester, operator, admin | `{ category, reason? }` |
| `POST` | `/api/shipments/:id/withdraw` | carrier, operator, admin | `{ category, reason? }` |
| `POST` | `/api/expedion/quotes/:id/cancel` | the quote owner, or an Expedion admin | `{ category, reason? }` |
| `POST` | `/api/listings/:id/revoke-award` | operator, admin | unchanged; now delegates |
| `PATCH` | `/api/shipments/:id/status` | unchanged | `CANCELLED` removed |

Boundary schemas live in `src/server/dto/cancellation.dto.ts`, not inline in the
route as the cancel route does today. The category enum is **derived** from
`shipmentCancellationCategoryEnum`, never restated. `reason` keeps its `min(3)`
floor — the mounted UI disables submit below three characters, and the orphaned
`cancelShipmentSchema` that says five is deleted along with the rest of the dead
v1 helpers in `shipment.dto.ts`.

### 8.1 Error codes

Every one a `ShipmentError`, which `api-response.ts` and `expedion-response.ts`
already translate — so no new class is needed in either list.

| Code | Status | When |
|---|---|---|
| `SHIPMENT_NOT_FOUND` | 404 | no shipment at that id |
| `SHIPMENT_NOT_CURRENT` | 409 | the run being stopped is not the one the listing holds |
| `CANCEL_VIA_SHIPMENT` | 409 | `DELETE /api/listings/:id` on an awarded job |
| `FORBIDDEN` | 403 | `partyFor` → `none` |
| `FORBIDDEN_DRIVER_CANNOT_WITHDRAW` | 403 | an employed driver tries to withdraw |
| `CANCEL_SYSTEM_ACCOUNT_FORBIDDEN` | 403 | the system account with no operator role |
| `USE_WITHDRAW_ENDPOINT` | 409 | a transporter calls `cancel` |
| `CANCEL_REQUIRES_SUPPORT` | 409 | `PICKED_UP` / `IN_TRANSIT`, side ≠ operator |
| `WITHDRAW_AFTER_PICKUP` | 409 | withdraw past `ASSIGNED` |
| `INVALID_STATUS_TRANSITION` | 409 | `DELIVERED`, or an illegal move |
| `CANCEL_VIA_CANCEL_ENDPOINT` | 409 | `updateStatus` asked for `CANCELLED` |
| `CATEGORY_NOT_FOR_SIDE` | 400 | a category outside the acting side's fence |
| `QUOTE_NOT_FOUND` | 404 | quote lane, non-owner **or** missing |

`REFUND_NOT_LOCAL` is never surfaced: it is caught inside the service.

### 8.2 Idempotency

A second cancellation of an already-`CANCELLED` shipment returns the existing row
with `alreadyCancelled: true`. Today the second call fires the refund **first**
and only then discovers `canTransition('CANCELLED','CANCELLED')` is false, so a
refund attempt goes out under a 409. The precedent is `shipment_confirmations`,
which absorbs a repeat rather than erroring.

---

## 9. Screen behaviour

### 9.1 One policy, four surfaces

`src/lib/cancellation-policy.ts` holds the predicates — `sideFor`,
`canCancelAs`, `canWithdrawAs`, `categoriesForSide` — and both the service and
the hooks import them. Today there are four disagreeing cancellability rules: the
service guard, the dead `canCancelShipment` DTO helper, `CANCELLABLE` in
`useDeliveryDetail`, and the driver surface's silence. The service stays
authoritative; the UI simply stops guessing differently.

### 9.2 The transporter's dialog

`WithdrawFromJobDialog`, mounted **inside** `PendingActions` and
`AssignedActions` — never at the `ShipmentActions` level, which
`driver/shipments/[id]/page.tsx` mounts twice (desktop column and mobile bar).
Trigger is `variant="outline"`: `ReportIncidentDialog` reserves `destructive` for
cancellation precisely so two red buttons never sit side by side.

Copy is the transporter's, not the client's: *"Je ne peux pas assurer ce
transport"*, and the confirmation says the job goes back to the board — because
that is what happens, and a driver who thinks they are cancelling the client's
delivery will hesitate to press a button they should press early.

### 9.3 The requester's dialog

The existing dialog gains a category `Select` whose options come from
`categoriesForSide('requester')`, and stops closing before the mutation resolves,
so `CANCEL_REQUIRES_SUPPORT` is shown in the dialog rather than surviving only as
a toast.

### 9.4 The accidental second route

A self-assigned carrier resolves to `"carrier"` in `roleFor` (it checks
`carrierId` before `driverId`) and is currently shown the **client's** cancel
button and copy on `/deliveries/[id]`, which the driver dashboard links to. Once
the shared policy decides, a transporter sees withdraw on the driver surface and
nothing on the client one. `roleFor`'s fall-through to `"shipper"` — which shows
an operator the requester's wording — is fixed in the same pass.

### 9.5 What the record shows

Both detail screens render the side and the category beside the free-text
reason: *"Annulée par le transporteur — véhicule en panne"*. The timeline step
for `CANCELLED` gains the same line.

---

## 10. Known limitations

1. **No cancellation fee, on either side.** A transporter who drops a job ninety
   minutes before a Paris pickup loses nothing; a requester cancelling the same
   morning is refunded in full. This is a refusal, not an oversight: both refund
   call sites omit Stripe's `amount` so a partial refund is structurally
   impossible, `payments` has no column to hold a retained figure, payouts stop
   at `scheduled`, and the commission split is undecided (`ROADMAP.md` §10). The
   side and category are recorded so a policy can later be written against real
   French data. Note the rate is **0.1**, not the 1.0 that `CLAUDE.md`,
   `db/schema/payments.ts` and `TESTING_MOCKS.md` still claim.
2. **A direct client is refunded and then charged again.** If their card has been
   detached in between, the re-award fails with `PAYMENT_METHOD_REQUIRED` and the
   job cannot be re-awarded until they add one. Holding the money instead was
   rejected: it leaves a driverless job's money with the platform, and the
   client's own protection is worth more than the saved round trip.
3. **No clawback after delivery** (§5.6). `payout_status = 'cancelled'` and
   `invoice_status = 'void'` exist and nothing writes either.
4. **The re-boarded job is not the job that was posted.** Its window may have
   slid 24 h and the replacement's price will differ. The client is told; they
   are not *asked*. For a hard-deadline job an operator has to catch it.
5. **The Flutter client renders a cancelled quote as "En attente".**
   `stageFromApiStatus` has no `cancelled` case and falls through to the default.
   That is a change in `expedion_encheres` and belongs in the same release.
6. **`expedion_quotes.payment_status = 'refunded'` stays unreachable.** The event
   says `refundIssued: false` and a human closes the loop in the Expedion Stripe
   account. Writing the value here would say money moved when it has not.
7. **`listingsService.cancelListing` remains a separate door**, and only for a
   listing nobody has taken. It refuses `awarded` and `in_progress` with
   `CANCEL_VIA_SHIPMENT`, for anybody — an admin included, since `/admin/listings`
   calls the same route from a button. Before that guard it would cancel a live
   job with no refund, `accepted_offer_id` still set and the run still on the
   driver's screen, which bypassed every guarantee this feature makes.

---

## 11. Non-goals

- Reliability scoring, strike counts, or a `carriers.cancelled_jobs` counter.
- An adjudication queue at `/admin/cancellations`.
- Cancellation through the signed confirmation link. That token is texted to
  people with no account and lives 30 days; it grants nothing and must keep
  granting nothing.
- Propagating a cancellation that originates in the Expedion admin surface
  (`PATCH /api/expedion/quotes/:id/admin`). It touches nothing here today and
  still will not.

---

## 12. Test coverage required

**Policy** (`src/lib/__tests__/cancellation-policy.test.ts`)
- `sideFor` for all five party/origin combinations, including `shipper + expedion → operator`.
- `canCancelAs` / `canWithdrawAs` across all six statuses × three sides.
- `categoriesForSide` covers `shipmentCancellationCategoryEnum` exactly, with no value orphaned.

**Cancellation service** (`src/server/services/__tests__/shipment-cancellation.service.test.ts`)
- Requester cancels at `PENDING` and `ASSIGNED`: shipment cancelled with side/category/actor, listing `cancelled`, `accepted_offer_id` cleared, refund attempted with the **listing** id.
- Requester refused at `PICKED_UP` with `CANCEL_REQUIRES_SUPPORT`, and **no refund attempted**.
- A carrier calling cancel gets `USE_WITHDRAW_ENDPOINT`.
- A driver calling withdraw gets `FORBIDDEN_DRIVER_CANNOT_WITHDRAW`.
- Carrier withdraws at `ASSIGNED`: listing back to `open`, winner `withdrawn`, rivals restored, `reopened_at` stamped, listing **not** `cancelled`.
- Withdraw refused at `PICKED_UP` with `WITHDRAW_AFTER_PICKUP`.
- Operator cancels at `IN_TRANSIT` — the lane that is impossible today.
- Still cancels when the refund is not ours to make (`REFUND_NOT_LOCAL`), and records the refund-owed event.
- A refund that fails for any other reason still cancels **and** stamps `refundFailed`.
- Second cancel returns `alreadyCancelled: true` and fires no second refund.
- System-account session with no operator role → `CANCEL_SYSTEM_ACCOUNT_FORBIDDEN`.
- A category outside the acting side's fence → `CATEGORY_NOT_FOR_SIDE`.

**Re-board** (`src/server/services/__tests__/offers.service.test.ts`)
- `reopenForRebid` rewrites `expires_at` into the future.
- A listing whose pickup window has passed gets the whole window slid forward, durations preserved.
- The listing is taken `FOR UPDATE` inside the transaction.
- `revokeAward` still answers `FORBIDDEN_NOT_OPERATOR`, and `WITHDRAW_AFTER_PICKUP` once the goods are collected (it delegates, so the old `SHIPMENT_ALREADY_STARTED` is gone — one refusal, one code).

**Guards added after review** (same files)
- An orphaned shipment — one left alive by `compensateFailedAward` — cannot be
  withdrawn from or cancelled: `SHIPMENT_NOT_CURRENT`, and no money moves.
- A retry of a half-applied cancellation finishes the listing, the re-board and
  the Expedion write-back rather than answering "already done".
- An admin cancelling on the quote lane is recorded as the **operator**, and the
  route returns a projection, never the shipment row.
- A carrier whose award an operator revokes is notified.
- The re-pointed Expedion charge carries the replacement driver's price.
- A `scheduled` payout is voided when the money behind it goes back.
- `reopenForRebid` slides rather than publishing an unusably short window, and
  decrements `offers_count` for the withdrawn winner.
- `compensateFailedAward` repairs the expiry and leaves the client's dates alone.
- `DELETE /api/listings/:id` refuses an awarded job, for an admin too.

**Payments** (`src/server/services/__tests__/payments.service.test.ts`)
- `refundForJob` finds the captured payment by listing, including one detached from a dead shipment.
- `REFUND_NOT_LOCAL` for `source='expedion'`.
- A non-captured row is returned untouched.
- `recordExternalCharge` re-points an existing captured `expedion` row instead of writing a second.

**Bridge** (`src/server/services/__tests__/expedion-bridge.service.test.ts`)
- `onAwardWithdrawn` writes `escalated` and clears carrier, `assigned_at` and `assigned_directly` **together**.
- `onJobCancelled` writes `cancelled` and the refund-owed event.
- Both are no-ops for a `direct` listing.

**Back door** (`src/server/services/__tests__/shipment.service.test.ts`, `shipment-photo-gate.test.ts`)
- `updateStatus` with `CANCELLED` throws `CANCEL_VIA_CANCEL_ENDPOINT`.
- The photo gate still never demands a photo to cancel — re-asserted through the cancellation service.

**Gates**
`npx tsc --noEmit` · `pnpm lint` · `pnpm test` — including
`src/db/__tests__/migrations-journal.test.ts` (the new migration is registered
with a strictly increasing `when`) and `src/i18n/__tests__/locale-parity.test.ts`
(every new key in both catalogues, none empty) · `pnpm build`.

**Deploy order.** A Vercel deploy never migrates. **Actions → Migrate database**
must run *before* the deploy, or `cancelled_by_side` does not exist and every
cancellation 500s.
