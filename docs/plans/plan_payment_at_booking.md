# Plan — Payment at booking

**Requirement, from the client (2026-08-29):**

> Payment happens before delivery, at the time of booking/reservation.
> Once the transport is confirmed and chosen, the client makes the payment.

Spec: `docs/specs/payment_at_booking_spec.md`.

---

## Why this is a change and not a no-op

The rule is already half-true on each inlet, and false on each in the opposite
direction.

**The direct lane has the right timing and the wrong money.** A job posted at
`/create` costs the poster nothing until an offer is accepted, at which point
`authoriseForShipment` places a *hold*. Nothing is debited until delivery
(`settleDelivery` → `captureForShipment`). So the client is not charged at
booking; they are charged on arrival.

**The Expedion lane has the right money and the wrong timing.** The client is
really charged, but in the Expedion app at *quote acceptance* — before a driver
exists, let alone is chosen. Expeditoo then puts a *second* money event on the
award, against `listing.shipperId`, which for an escalated job is the system
account `EXPEDION_SYSTEM_USER_ID`. That account has no card.

That second point is a live blocker, not a stylistic one. With `MOCK_PAYMENTS`
off, `authoriseForShipment` reaches its `stripeCustomerId` guard, throws
`PAYMENT_METHOD_REQUIRED`, and `compensateFailedAward` unwinds the award — so
**no escalated job can be awarded at all outside mock mode**. It works today
only because `.env.local:93` sets the flag.

## Decisions taken

Both were put to the client and answered on 2026-08-29:

1. **Charged at booking, not held.** Immediate capture when the offer is
   accepted. Delivery stops moving the client's money and only settles what the
   driver is owed. A cancellation becomes a refund rather than a release.
2. **The card is collected at posting time**, on `/create`, before the job goes
   live — not at the moment of accepting an offer. A direct job reaches the
   board already fundable, so no carrier bids on work that cannot be paid for.

## Shape

| Lane | Who pays | When | What this repo does at award |
|---|---|---|---|
| Direct (`/create`) | The poster | At award, off-session against the card saved at posting | Charges. Row → `captured`, `source='stripe'` |
| Expedion | The Expedion client, in Expedion, at quote acceptance | Already paid | Charges **nothing**. Row → `captured`, `source='expedion'`, no intent |

The `source` column is what lets one `payments` row mean both things without
the payout, invoice and earnings code learning a second vocabulary: in both
cases the money is genuinely captured, so `status='captured'` stays honest and
everything downstream of it is untouched.

## Steps

1. **Migration** — `payment_source` enum (`stripe` | `expedion`) and
   `payments.source`, defaulting to `stripe`. Register it in
   `meta/_journal.json`; `migrations-journal.test.ts` fails the build otherwise.
2. **`payments.service.ts`** — `authoriseForShipment` → `chargeForShipment`
   (confirm + automatic capture, off-session, `source` aware);
   `captureForShipment` deleted; `releaseForShipment` → `refundForShipment`.
   Mock path follows.
3. **`offers.service.ts`** — call `chargeForShipment`; `revokeAward` refunds
   instead of releasing.
4. **`shipment.service.ts`** — `settleDelivery` no longer captures;
   `cancelShipment` refunds.
5. **`listings.service.ts`** — refuse to put a direct job on the board without a
   card on file, on both `createListing({publish:true})` and `publishListing`.
6. **`/create`** — a fifth step that shows the saved card or collects one.
7. **`refund.service.ts`** — refuse an `expedion`-source payment; that refund
   belongs to Expedion, which owns the charge.
8. **Tests** — `payments`, `offers`, `settle-delivery`, `shipment`, `listings`,
   `refund`; plus the new create step.
9. **i18n** — FR/EN parity, verified by key diff.

## Dependencies

- `stripeService.createSetupIntent` and `listPaymentMethods` already exist and
  are already wired to `/profile/payment-methods`; the create step reuses
  `AddPaymentMethodForm`'s Stripe Elements shape rather than inventing one.
- Stripe test keys are present in `.env.local`, so the card step is exercisable
  locally even while `MOCK_PAYMENTS` stays on for the charge itself.

## Out of scope

- The commission split (`ROADMAP.md` §10). This changes *when* money moves, not
  how it is divided. `COMMISSION_RATE` is untouched.
- Real Stripe hold/capture infrastructure beyond what this needs — the
  `MOCK_PAYMENTS` flag survives, now mocking a charge rather than a hold.
- Expedion-side refund handling. `reportToExpedion(..., "CANCELLED")` already
  tells that app a job is off; what it does about the money is its own.
