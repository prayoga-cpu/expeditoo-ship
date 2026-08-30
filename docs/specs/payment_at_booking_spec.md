# Spec — Payment at booking

Plan: `docs/plans/plan_payment_at_booking.md`.

**The rule.** The client pays when the transport is confirmed and chosen — at
booking — and the money is *taken*, not held. Delivery no longer touches the
client's card; it settles only what the driver is owed.

---

## 1. `payments.source`

`payment_source` enum: `stripe` | `expedion`. Column `payments.source`,
`NOT NULL DEFAULT 'stripe'`.

It records **who took the money**, which is not the same question as
`listings.origin` (where the job came from) and must not be inferred from it at
read time. A row is `expedion` when the charge happened in the Expedion app
before this repo ever saw the job.

`status='captured'` is true for both: the client really has been debited. That
is deliberate — payouts, invoices and earnings all key off `captured` and learn
nothing new.

Historical values `authorised` and `released` stay in `payment_status`. Nothing
writes them after this change; rows that carry them predate it. They are not
removed because the enum values are still referenced by existing data.

## 2. Charging — `paymentsService.chargeForShipment`

Replaces `authoriseForShipment`. Called from `offersService.acceptOffer` after
the award commits, outside the transaction, exactly where the old call sat.

```
chargeForShipment({
  shipperId, shipmentId, listingId, amountCents,
  stripeCustomerId, source,
})
```

### 2.1 `source: 'expedion'`

No Stripe call. Insert one row: `status='captured'`, `source='expedion'`,
`capturedAt=now`, `stripePaymentIntentId=null`, commission computed as usual.

Returns `{ payment, clientSecret: null, requiresAction: false }`.

This is the fix for the award blocker. `stripeCustomerId` is not consulted, so
the cardless system account is no longer a reason an escalated job cannot be
awarded.

`stripe_payment_intent_id` is `UNIQUE` and nullable; Postgres does not collide
NULLs, so any number of `expedion` rows coexist.

### 2.2 `source: 'stripe'`

1. `PAYMENT_METHOD_REQUIRED` (402) if `stripeCustomerId` is null.
2. `PAYMENT_METHOD_REQUIRED` (402) if the customer has no saved card. The card
   was collected at posting (§4); its absence here means it was detached
   between posting and award.
3. Insert the row `pending`.
4. `stripe.paymentIntents.create` with `capture_method: 'automatic'`,
   `confirm: true`, `off_session: true`, the customer's default card,
   `transfer_group`, and `{shipmentId, listingId}` metadata.
5. `succeeded` → `captured` + `capturedAt`. Anything else → `failed`, and throw
   `PAYMENT_CHARGE_FAILED` (402).

Off-session is correct: the client saved the card at posting under
`usage: 'off_session'`, and an operator may award an escalated job with nobody
watching. An SCA challenge therefore fails the charge rather than prompting —
`authentication_required` is a `PAYMENT_CHARGE_FAILED` like any other.

### 2.3 On failure

Unchanged from the hold era: `acceptOffer` catches, calls
`compensateFailedAward`, and the job returns to the board with every bid intact.
The client is not charged and the driver is not told they won.

### 2.4 Idempotency

Re-accepting an already-accepted offer returns early in `acceptOffer` before
reaching the charge, as it does today. A second `chargeForShipment` for a
shipment that already has a `captured` row returns that row untouched rather
than charging twice.

## 3. Mock mode

`MOCK_PAYMENTS=true` writes the row straight to `captured` with a synthetic
`pi_mock_<shipmentId>` intent and `source='stripe'`, skipping Stripe entirely —
the same shape the real path produces. The `source='expedion'` branch is
checked **before** the mock branch, because it is not a mock: it is the real
behaviour of a job whose money moved in another app.

Marked `TODO(EXPEDITOO-TESTING)` like every other mock, and listed in
`docs/TESTING_MOCKS.md`.

## 4. A direct job may not go live without a card

Enforced in `listingsService`, not in the route.

- `createListing` when `publish: true`
- `publishListing`

Both throw `PAYMENT_METHOD_REQUIRED` (402) when the shipper has no saved card.

**A draft is exempt.** A draft is not on the board, no carrier can bid on it,
and demanding a card to save one would be a toll on a form that has not
committed to anything.

**Escalated listings are exempt.** They are created by
`expedionEscalationService`, owned by the cardless system account, and their
client has already paid. The check applies to a shipper posting for themselves.

Under `MOCK_PAYMENTS` the check is skipped — the charge it protects is mocked
too, so enforcing it would only block the testing journey. `TODO(EXPEDITOO-TESTING)`.

## 5. Delivery no longer charges

`settleDelivery` drops `captureForShipment`. It reads the payment, and:

- `captured` → `schedulePayout`, then `invoicesService.createFromPayment`, each
  in its own try, as now.
- anything else → log and skip the payout. A delivery is a real-world event and
  is never rolled back because the money is in an unexpected state; the row is
  left for support rather than silently paid out.

`captureForShipment` is deleted. Nothing calls it after this change, and leaving
a capture entry point on a flow that captures at booking invites a double charge.

## 6. Cancellation and revocation refund

`releaseForShipment` → `refundForShipment(shipmentId)`. Callers unchanged:
`shipmentService.cancelShipment` and `offersService.revokeAward`.

| Payment state | Behaviour |
|---|---|
| none | `null` — nothing was ever taken |
| `refunded` | returns the row; refunding twice is a no-op, not an error |
| `source='expedion'` | throws `REFUND_NOT_LOCAL` (409) |
| `captured`, mock intent | row → `refunded` + `refundedAt`, no Stripe call |
| `captured`, real intent | `stripe.refunds.create`, then row → `refunded` |
| `pending` / `failed` | returned unchanged |

A row that never reached `captured` took nothing from the client. Marking it
`refunded` would put a refund in front of an operator on `/admin/payments` that
never happened, so it is left exactly as it is.

**`REFUND_NOT_LOCAL` is not an error the caller should die on.** Both callers
already `.catch(console.error)` around the money step, deliberately: a
cancellation must not be blocked by a payment problem. An Expedion job's refund
is Expedion's to make, and `reportToExpedion(listingId, "CANCELLED")` is what
tells it to.

`refundService.processRefund` — the admin surface — throws the same
`REFUND_NOT_LOCAL` for an `expedion` row, so `/admin/payments` cannot issue a
refund against a charge this platform never took.

## 7. `/create` — the card step

A fifth step, `payment`, after `budget`. `JOB_STEPS` becomes
`["what", "where", "when", "budget", "payment"]`.

- On mount, `GET /api/stripe/payment-methods`.
- One or more cards → show the first (brand + last 4) and confirm the job will
  be charged to it when a carrier is chosen. "Post the job" enabled.
- No cards → `PaymentElement` on a SetupIntent from
  `POST /api/stripe/setup-intent`, confirmed with `redirect: "if_required"`.
  On success, refetch and fall through to the case above.
- "Save as draft" stays enabled throughout the step, including with no card
  (§4).

The step declares no form fields, so `STEP_FIELDS` gains an empty entry and
per-step validation passes through it untouched.

The copy states the amount is not taken now: what is charged is the winning
offer, which does not exist yet. The step collects permission to charge, not a
payment.

## 8. Error codes

| Code | Status | Raised by |
|---|---|---|
| `PAYMENT_METHOD_REQUIRED` | 402 | `chargeForShipment`, `createListing`, `publishListing` |
| `PAYMENT_CHARGE_FAILED` | 402 | `chargeForShipment` |
| `REFUND_NOT_LOCAL` | 409 | `refundForShipment`, `refundService.processRefund` |
| `PAYMENT_NOT_FOUND` | 404 | `refundService.processRefund` |

`PAYMENT_AUTHORISATION_FAILED` and `PAYMENT_NOT_AUTHORISED` are gone with the
functions that raised them.

## 9. Test coverage required

**`payments.service.test.ts`**
- `expedion` source writes a captured row with no intent and never calls Stripe
- `expedion` source succeeds with a null `stripeCustomerId` — the escalated-award regression
- `stripe` source with no customer throws `PAYMENT_METHOD_REQUIRED`
- `stripe` source with a customer but no saved card throws `PAYMENT_METHOD_REQUIRED`
- a successful charge creates an automatic-capture, confirmed, off-session intent
- a non-`succeeded` intent marks the row `failed` and throws `PAYMENT_CHARGE_FAILED`
- a Stripe throw marks the row `failed` and throws `PAYMENT_CHARGE_FAILED`
- charging a shipment that already has a captured row returns it and does not charge again
- mock mode captures with a `pi_mock_` intent and no Stripe call
- refund: expedion row throws `REFUND_NOT_LOCAL`
- refund: mock intent marks `refunded` without calling Stripe
- refund: real intent calls `stripe.refunds.create`
- refund: an already-refunded row is a no-op
- refund: no payment returns null
- `hasSavedCard`: false with no customer, and without asking Stripe
- `hasSavedCard`: false for a customer whose card was detached, true once attached

**`offers.service.test.ts`**
- an escalated award charges nothing and still produces a captured payment
- a direct award charges `listing.shipperId`, never the actor
- a charge failure compensates the award and rethrows
- `revokeAward` refunds rather than releases

**`settle-delivery.test.ts`**
- delivery schedules the payout and writes the invoice without capturing
- delivery on a non-captured payment skips the payout and does not throw

**`shipment.service.test.ts`**
- `cancelShipment` refunds
- a `REFUND_NOT_LOCAL` throw does not prevent the cancellation
- a run already on the road refuses the cancellation and refunds nothing

**`listings.service.test.ts`**
- publishing without a card throws `PAYMENT_METHOD_REQUIRED`
- saving a draft without a card succeeds
- `createListing({publish:true})` without a card throws
- `{ prepaid: true }` waives the check and never asks about a card
- mock mode skips the check

**`refund.service.test.ts`**
- an `expedion` payment cannot be refunded from `/admin/payments`

**`PaymentStep.test.tsx`**
- a saved card renders, and is reported upward as what unlocks posting
- a saved card does not open a SetupIntent
- no card renders the Stripe form and reports no card
- a failed lookup reports no card rather than guessing
- the copy states nothing is charged yet
- renders in French with no missing key

**Migration** — `migrations-journal.test.ts` passes with the new file registered.
