# Plan: pay a driver only for a delivered job the client still pays for

## Why

The client asked whether carriers could be paid by IBAN transfer instead of
Stripe. The answer depends on a legal model the client and their lawyer have to
choose (does Expeditoo sell the transport in its own name, or is it an
intermediary?), so no payout rail is built here. The owner's call was: ask
first, and meanwhile fix only what is wrong whatever they decide.

Four things are wrong today, and none depends on the rail:

1. **A driver can be paid before delivering.** Off-session charges carry a
   `transfer_group`, so the `payment_intent.succeeded` webhook schedules the
   driver's payout at capture — which since payment-at-booking is the award.
   `withdrawalsDal.availableFor` counts any `scheduled` row, so that pay is
   withdrawable before anyone has driven anywhere.
2. **A refunded job can still be paid.** A refund voids only a `scheduled`
   payout. A payout already claimed by a withdrawal is `processing` and
   survives; rejecting that withdrawal puts it back to `scheduled`; approving
   it or recording it paid checks nothing. And `POST /api/admin/refunds`, the
   one path that can refund a *delivered* job, voids nothing at all.
3. **`/profile` tells every user to connect Stripe** to be paid for « articles
   vendus ou … livraisons » — goods-marketplace copy, shown to people who are
   not drivers, about a rail that pays nobody (`executePayout` has no caller).
4. **Two comments and two docs say false things**: the banking route says the
   IBAN is forwarded to Stripe (only the last 4 characters are kept), and
   `ROADMAP.md` / `docs/TESTING_MOCKS.md` say `COMMISSION_RATE` is 1.0 (it is
   0.1).

## Steps

1. **Webhook** — delete `recordCarrierPayout` and its call; the webhook settles
   the charge and nothing else. `settleDelivery` stays the one writer.
2. **Payment lookups** — `getForShipment` prefers the captured row over a
   failed attempt on the same shipment; `schedulePayout` computes from the
   captured row and refuses `PAYMENT_NOT_CAPTURED` otherwise. With the webhook
   gone, `settleDelivery` is the only chance to write the payout, so it must not
   be thrown off by an earlier declined attempt.
3. **Refunds** — `markRefunded` voids the unpaid payouts drawn on the payment,
   in the same transaction as the status flip; `cancelPayoutForShipment` voids
   `processing` as well as `scheduled`.
4. **Balance** — `availableFor` / `availableRows` join the shipment and the
   payment and count only `DELIVERED` + `captured`.
5. **Decisions** — a pure `payoutStanding` classifies each claimed payout
   (`payable` / `undelivered` / `void`). Approve and mark-paid refuse
   `WITHDRAWAL_HAS_INVALID_PAYOUT` unless every claimed payout is payable and
   they still add up to the frozen amount. Reject returns `payable` and
   `undelivered` payouts to the balance and voids the rest. Every payout and
   withdrawal write names the status it moves from, so a refund or a second
   operator acting at the same moment cannot be overwritten; the claim in
   `request` gets the same guard (`WITHDRAWAL_BALANCE_CHANGED`).
6. **Queue** — *Refuse* is offered on approved rows too (an approved request
   that can no longer be paid otherwise has no exit, and blocks the driver's
   next request); both new codes get their own toast.
7. **Profile** — remove the card, its handler, its `?stripe=error` toast, the
   profile hook's Stripe-status read and `payoutApi`; delete `profile.payout.*`.
   Routes and services untouched.
8. **Corrections** — banking route comment; `ROADMAP.md` §10.1;
   `docs/TESTING_MOCKS.md` §6 and walkthrough step 7; superseded notes in
   `cancellations_spec.md` and `stripe_connect_spec.md`.
9. **Tests** — see the spec's §9.
10. **After review** — refusing an *approved* request goes through a
    confirmation and sends the driver its own notice; an approve or mark-paid
    that loses a race to a colleague's decision answers
    `WITHDRAWAL_ALREADY_SETTLED` (re-read, never a reordering, which deadlocks
    against reject); and a status move to `DELIVERED` is a compare-and-set, so
    two people pressing « Livré » at once settle one payout
    (`cancellations_spec.md` §7.1).

## Files

- `src/server/services/stripe.service.ts`
- `src/server/services/payments.service.ts`
- `src/server/services/withdrawals.service.ts`
- `src/server/dal/withdrawals.dal.ts`
- `src/server/services/shipment-cancellation.service.ts` — comment only
- `src/features/app/withdrawals/hooks/useWithdrawals.ts`
- `src/features/app/withdrawals/ui/WithdrawalQueue.tsx`
- `src/features/app/profile/ui/Profile.tsx`
- `src/features/app/profile/hooks/useProfile.ts`
- `src/features/app/profile/api/payout.api.ts` — deleted; `api/index.ts`
- `src/app/api/carrier/banking/route.ts` — comment only
- `ROADMAP.md`, `docs/TESTING_MOCKS.md`, `docs/specs/cancellations_spec.md`,
  `docs/specs/stripe_connect_spec.md`
- Tests: `stripe-webhook-capture.test.ts`, `payments.service.test.ts`,
  `invoice-capture-hook.test.ts`, `withdrawals.service.test.ts`,
  `shipment-cancellation.service.test.ts`, new
  `src/server/dal/__tests__/withdrawals.dal.test.ts`, new
  `src/features/app/withdrawals/ui/__tests__/WithdrawalQueue.test.tsx`, new
  `src/features/app/profile/ui/__tests__/Profile.test.tsx`
- Messages: FR/EN through `i18n.patch.json` (two keys set, `profile.payout`
  deleted) — applied by the integrator.

## Not in scope

- Storing the IBAN, a SEPA batch, Stripe Connect embedded onboarding, or any
  rail: they wait on the legal model.
- Who pays the driver on an escalated job (Expedion took that money).
- Showing the operator which jobs a request covers, and a clawback for a payout
  already paid when its job is refunded later.
- A migration: every status used here already exists in `payout_status`.
