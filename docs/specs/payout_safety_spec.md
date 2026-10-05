# Spec — Payout safety: a driver is paid only for a delivered job the client still pays for

Release 2.60.0. Plan: `docs/plans/plan_payout_safety.md`.

Covers the `payment_intent.succeeded` webhook (`stripe.service.ts`);
`paymentsService.getForShipment`, `schedulePayout`, `cancelPayoutForShipment`
and `markRefunded`; `withdrawalsDal`; `withdrawalsService.getBalance`,
`request` and `decide`; the operator queue (`WithdrawalQueue`, `RefuseButton`,
`useDecideWithdrawal`) and the driver's request hook (`useRequestWithdrawal`);
the payout card on `/profile`; and two documents that misstated the commission.

## 0. Where this comes from

The client asked « est-ce qu'il y a une autre solution que Stripe, avec un
virement IBAN ? ». The honest answer depends on a legal model only the client and
their lawyer can choose — whether Expeditoo sells the transport in its own name
(then a plain SEPA transfer from its own bank is fine) or acts as an
intermediary (then the client's money has to go through a licensed provider).
No rail is built here, and the IBAN is still kept as its last 4 characters only.

What *is* built is everything that is wrong whatever they choose: today a driver
can be paid before delivering, and for a job whose client was refunded.

How a driver is actually paid, before and after this change: the client's money
lands in the platform's own Stripe balance; the delivery writes a `payouts` row
for the price less the 10 % commission (`COMMISSION_RATE = 0.1` in
`payments.service.ts`); the driver asks for their balance in *Mes gains*
(minimum €20); an operator, finance user or admin approves it, makes the bank
transfer by hand outside the app, and records its reference. Nothing in the app
moves money to a driver.

---

## 1. A payout is written at delivery, and only there

**Before.** The webhook called `recordCarrierPayout` → `schedulePayout` for every
succeeded intent carrying a `transfer_group`. Off-session charges carry one
(`chargeForShipment`), and since payment-at-booking the capture is the award — so
a `scheduled` payout existed before anyone had driven anywhere, and the balance
counted it.

**After.**

- `payment_intent.succeeded` settles the charge (`captureByIntent`) and does
  nothing else. `recordCarrierPayout` is deleted.
- `settleDelivery` (`shipment.service.ts`) is the only caller of
  `schedulePayout`. `shipmentService.updateStatus` calls it on the transition
  into `DELIVERED`, after the delivery-photo gate (`requirePhotoFor`), and
  `settleDelivery` writes the payout only when the shipment's payment is
  `captured`. Pinned by `settle-delivery.test.ts` and
  `shipment-photo-gate.test.ts`.
- `getForShipment` returns the shipment's **captured** payment when there is
  one, otherwise the most recent row. `payments.shipment_id` has no unique index
  and a declined attempt can share a shipment with the charge that succeeded;
  an unordered read could hand `settleDelivery` the dead attempt, and with the
  webhook gone nothing else would ever write that driver's payout.
- `schedulePayout` computes the payout from that captured payment, and refuses
  `PAYMENT_NOT_CAPTURED` when there is none (`settleDelivery` logs it). The
  payout's `payment_id` is therefore always a captured row, which §2 relies on.

**Rows written before 2.60.0** at award may still exist (a real off-session
charge with the webhook forwarded). They are not deleted: §2 keeps them out of the
balance until their job is delivered, and §3 voids them if it never is.

## 2. What counts as payable

A payout is **payable** when all three hold:

| Fact | Must be |
|---|---|
| `payouts.status` | `scheduled` for the balance; `processing` inside the request that claimed it |
| its shipment (`payouts.shipment_id`) | `DELIVERED` |
| its payment (`payouts.payment_id`) | `captured` — so not `refunded`, and not missing |

### 2.1 The balance

`withdrawalsDal.availableFor` and `availableRows` count a payout only when it is
`scheduled`, unclaimed (`withdrawal_id IS NULL`), its shipment is `DELIVERED`
and its payment is `captured`. Both join with **inner** joins: a payout whose
payment row is gone cannot be shown to be paid for, and is not counted.

`getBalance.deliveries` is the number of those rows, unchanged in meaning.
`hasEverEarned` is untouched (any payout, any status).

### 2.2 The standing of a claimed payout

`payoutStanding(row)` — pure, exported from `withdrawals.service.ts` — classifies
a payout already claimed by a request:

| Standing | When | Approve / mark paid | Reject |
|---|---|---|---|
| `payable` | `processing`, payment `captured`, shipment `DELIVERED` | allowed | back to `scheduled`, unlinked |
| `undelivered` | `processing`, payment `captured`, shipment neither `DELIVERED` nor `CANCELLED` | refused | back to `scheduled`, unlinked — counted again once delivered |
| `void` | anything else: payout not `processing` (a refund voided it), payment not `captured` or missing, shipment `CANCELLED` | refused | `cancelled`, unlinked |

`undelivered` exists only for rows written at award before 2.60.0. It must not be
voided: when that job is delivered, `schedulePayout` finds the existing row and
returns it rather than writing a new one, so a voided row there would leave the
driver unpaid for a delivery they made.

## 3. A refund voids what has not been paid

- **`markRefunded`** — the only transition into `refunded`, used by
  `refundForJob` and by `refundService.processRefund` (`POST /api/admin/refunds`,
  the one path that can refund a *delivered* job). In **one transaction** it flips
  the payment and sets every payout drawn on it (`payment_id` = it) that is
  `scheduled` or `processing` to `cancelled`. The credit note follows outside the
  transaction, contained as before.
- **`cancelPayoutForShipment`** — called by both cancellation verbs before the
  refund is attempted, and whatever its outcome (the run is over even when the
  money is Expedion's, `REFUND_NOT_LOCAL`, or the refund fails). It now voids a
  `processing` payout as well as a `scheduled` one.
- A voided payout **keeps its `withdrawal_id`**: the request it was in now visibly
  covers a voided payout, and §4 refuses to pay it until an operator refuses the
  request.
- A `paid` payout is never touched. That money has left; recovering it is a human
  matter (§8).

## 4. Deciding a withdrawal

`requireOperator` is unchanged (operator, admin or finance).

| Action | Allowed from | Check | Writes |
|---|---|---|---|
| `approve` | `requested` | every claimed payout `payable`, at least one, and their total equals the request's frozen `amountCents` | the request → `approved` |
| `mark_paid` | `requested`, `approved` | a reference; then the same check | one transaction: the claimed payouts `processing` → `paid`; the request → `paid` |
| `reject` | `requested`, `approved` | none | one transaction: `payable` and `undelivered` payouts → `scheduled`, unlinked; every other payout still linked → `cancelled`, unlinked; the request → `rejected` |

**The amount is never recomputed.** It was frozen when the driver asked and is
the figure the operator approves (`withdrawals.amount_cents`). A request that no
longer adds up is refused whole; the operator refuses it, what is still owed goes
back to the balance, and the driver asks again for the right amount.

**Every write names the status it moves from**, so a refund or a second operator
acting at the same moment is never overwritten:

| Write | Guard | When the guard matches fewer rows |
|---|---|---|
| claim (`request`) | `scheduled` and unclaimed | roll back, `WITHDRAWAL_BALANCE_CHANGED` |
| settle (`mark_paid`) | `processing` | roll back, `WITHDRAWAL_HAS_INVALID_PAYOUT` — or `WITHDRAWAL_ALREADY_SETTLED` when another decision settled the request (below) |
| release (`reject`) | `processing` | the row stays linked and is voided by the next write |
| void (`reject`) | not `paid` | — |
| the request row (all three) | `requested` or `approved` — `approve` from `requested` only, `reject` from the `seenStatus` it was sent with | roll back; `WITHDRAWAL_STATUS_CHANGED` when the request is still open in another status, else `WITHDRAWAL_ALREADY_SETTLED` |

Combined with §3's single transaction, a refund either lands before the payouts
are settled (the guard finds a `cancelled` row, nothing is recorded paid) or
after (the payout was paid first, the refund leaves it alone).

**A yes that loses the race answers `WITHDRAWAL_ALREADY_SETTLED`.** `approve`
and `mark_paid` check the claimed payouts before they reach the request row's
guard. When a colleague's decision lands first — a refusal unlinks the payouts,
a recorded transfer marks them `paid` — that check is what fails, and the
operator would be told the request covers an unpayable job and to refuse it,
when a colleague has already settled it. So `unlessSettledMeanwhile`
(`withdrawals.service.ts`) catches `WITHDRAWAL_HAS_INVALID_PAYOUT` from either
yes and re-reads the request once the transaction has rolled back:

- now `paid`, `rejected` or gone → `WITHDRAWAL_ALREADY_SETTLED`;
- still `requested` or `approved` → the payout really is unpayable, and
  `WITHDRAWAL_HAS_INVALID_PAYOUT` stands.

That covers the settle guard too: a transfer recorded between `mark_paid`'s
check and its settle leaves `settlePayouts` short, and the re-read finds the
request `paid`. The race is not closed by writing the request row first:
`reject` locks the claimed payouts and then the request row, and a `mark_paid`
taking them the other way round deadlocks against it on Postgres.

**The queue offers *Refuse* on approved rows** as well as requested ones. An
approved request that can no longer be paid otherwise has no way out in the UI —
and while it stays open the driver cannot ask for anything else
(`WITHDRAWAL_ALREADY_OPEN`). Both new codes toast their own message.

**On an approved row, *Refuse* asks first** (`RefuseButton`, the app's
`AlertDialog`). Approval is when the operator makes the transfer by hand, and a
refusal puts what the request still covers back in the balance, where the next
request claims it again: had the transfer been sent, the same deliveries would
be paid twice. The dialog names the amount and the driver, says the amount goes
back to the driver's balance — less any job refunded or cancelled since — and
can be requested again, and that refusing is only for a transfer that was never
sent. Its buttons are *Laisser approuvé* / *Keep it approved* and *Refuser —
virement non envoyé* / *Refuse — transfer not sent*. On a requested row
*Refuse* goes straight through: no transfer is made before approval.

**A decision carries the status the operator saw** (`seenStatus`). A queue
read before a colleague approved still shows « Demandé », with *Refuse*
that goes straight through — so a refusal sent from it would land on an
approved request, perhaps already paid by hand, without the confirmation
above. The queue sends the row's status with *Approve* and *Refuse*; `decide`
answers `WITHDRAWAL_STATUS_CHANGED` when the request now reads otherwise, and
`reject` writes the request row only from that status, so a colleague's
approval landing between the read and the write is caught too. The queue then
reads again and switches to « Tous »: on its default « Demandé » view the
request, now approved, would simply drop out of sight, and the toast tells the
operator to check it. Under « Tous » it shows as it now is, its *Refuse*
asking first. `approve`
writes only from `requested`, so two approvals racing let one through and
tell the driver once.

**Telling the driver.** Every decision notifies the driver (`notifyCarrier`:
type `payout_scheduled`, link `/carrier/withdrawals`), in English strings held
by the service (`carrierNotice`):

| Decision | Title | Message |
|---|---|---|
| approve | Withdrawal approved | Your withdrawal was approved. The transfer is being made. |
| mark_paid | Withdrawal paid | Your withdrawal has been transferred. |
| reject, request read as `requested` | Withdrawal refused | Your withdrawal request was refused. What you are still owed is available again. |
| reject, request read as `approved` | Withdrawal cancelled | Your approved withdrawal was cancelled. What you are still owed is available again. |

The refusal's notice follows the state `decide` read the request in. Read as
`approved`, a request stays approved until it closes, so the second notice is
always true. Read as `requested`, a colleague can approve it before the refusal
lands, so the first is worded to stay true either way — it no longer says the
withdrawal "was not approved", which contradicted an approval notice the driver
may already hold.

## 5. The payout card on `/profile` is gone

The *Configuration des virements* card told every user — not only drivers — that
they must connect a Stripe account to be paid « de vos articles vendus ou de vos
livraisons ». Goods-marketplace copy, and untrue: drivers are paid through *Mes
gains*, and the Connect account it opened is paid into by nothing
(`executePayout` has no caller).

Removed: the card, its button handler, the `?stripe=error` toast, the profile
hook's `/api/users/me/stripe-status` read (it fed only the card) and `payoutApi`
(its only caller was the card). Deleted keys: `profile.payout.*` in FR and EN.

Unchanged: `/api/stripe/connect`, `/connect/dashboard`, `/connect/return`,
`/connect/refresh`, `/api/users/me/stripe-status`, `stripeService`,
`executePayout`. A stale onboarding link that fails still lands on
`/profile?stripe=error`, now without a toast — the flow is no longer offered.

## 6. Corrections

- `src/app/api/carrier/banking/route.ts` said the IBAN and BIC are forwarded to
  Stripe. They are validated, the last 4 characters of each are stored, and
  nothing is forwarded anywhere (`carrier.service.ts` `setBanking`).
- `ROADMAP.md` §10.1 and `docs/TESTING_MOCKS.md` (§6 and walkthrough step 7) said
  `COMMISSION_RATE` is 1.0. It is 0.1 (`COMMISSION_RATE` in `payments.service.ts`).
- `cancellations_spec.md` §5.6 and §10.3, and `stripe_connect_spec.md` §3 and
  §6, carry a note pointing here.

## 7. Error codes

| Code | Status | Raised by | When |
|---|---|---|---|
| `WITHDRAWAL_HAS_INVALID_PAYOUT` | 409 | `decide` approve, mark_paid | a claimed payout is not `payable`, none is claimed, they no longer add up to the frozen amount, or a refund voided one between the check and the write — and the request, re-read, is still open (§4) |
| `WITHDRAWAL_BALANCE_CHANGED` | 409 | `request` | fewer payouts could be claimed than were just read (claimed by a parallel request, or voided by a refund) |
| `WITHDRAWAL_ALREADY_SETTLED` | 409 | `decide` | existing; now also when another decision on the same request lands first — at the request row's guard, or at a yes's payout check because a colleague refused the request or recorded it paid (§4) |
| `WITHDRAWAL_STATUS_CHANGED` | 409 | `decide` | the request is still open but no longer in the status the decision was made from: `seenStatus` differs, or a colleague's approval landed before this approve or refusal wrote (§4) |
| `PAYMENT_NOT_CAPTURED` | 409 | `schedulePayout` | the shipment has no captured payment — logged by `settleDelivery`, never reaches a browser |

`WithdrawalError` and `PaymentError` are already translated by `handleError`.

## 8. Known limits — not in this change

- **The rail and the legal model.** No IBAN storage, no SEPA batch, no Stripe
  Connect embedded onboarding until the client and their lawyer settle the model.
- **Escalated jobs.** The balance still counts a payout whose money Expedion took
  (`payments.source = 'expedion'`); who pays the driver on that lane is open
  (`ROADMAP.md` §10).
- **No clawback.** A payout already `paid` when its job is refunded stays paid.
- **Approved, transferred, then refunded.** If an admin refunds a delivered job
  after its request was approved *and* the transfer sent, the request can be
  neither recorded paid (§4) nor refused without the ledger misstating something
  — refusing returns shares that were in the transfer to the balance. The admin
  issuing a refund should check the driver's open request first; recording an
  overpayment is out of scope.
- **The queue does not list the jobs a request covers.** The operator learns a
  request is unpayable from the refusal, not beforehand.
- **The confirmation is the screen's, not the server's.**
  `POST /api/admin/withdrawals/:id` with `reject` refuses an approved request
  without asking; the API takes no "transfer not sent" flag. The queue is its
  only caller, and it always sends `seenStatus`, so it cannot refuse an
  approved request from a stale « Demandé » row.
- **The driver's notices are English**, as every withdrawal notice was before
  this change. A notification row stores literal text, so translating them is a
  change of its own.
- **The earnings summary** (`earnings.dal.ts`, `pendingCents`) still counts a
  `cancelled` payout as pending.

## 9. Test coverage required

**`stripe-webhook-capture.test.ts`**
- `payment_intent.succeeded` settles through `captureByIntent` and schedules no
  payout, even with a `transfer_group` and a `shipmentId`.

**`payments.service.test.ts`**
- `cancelPayoutForShipment` voids a `scheduled` and a `processing` payout, keeps
  the withdrawal link, and leaves a `paid` one alone.
- `markRefunded` voids the `scheduled` and `processing` payouts drawn on the
  payment, leaves a `paid` one and another payment's payouts alone; reached
  through `refundForJob`.
- `getForShipment` prefers the captured row over a later or earlier failed one.
- `schedulePayout` computes from the captured row when a failed attempt shares
  the shipment, and refuses `PAYMENT_NOT_CAPTURED` with no captured row.

**`invoice-capture-hook.test.ts`**
- `markRefunded` still raises the credit note, and still returns the refunded
  row when the note fails.

**`withdrawals.service.test.ts`**
- `payoutStanding` for every row of §2.2.
- approve: refused for a `void` and an `undelivered` payout, for no claimed
  payout, and for a total that no longer matches; writes nothing when refused;
  allowed when everything is payable.
- mark_paid: refused likewise, writing nothing; settles every claimed payout and
  the request in one transaction; rolls back when the settle guard finds fewer
  rows than were checked.
- reject: releases `payable` and `undelivered`, voids the rest, in one
  transaction.
- reject notifies *Withdrawal refused* — never "not approved" — for a request
  read as `requested`, and *Withdrawal cancelled* for one read as `approved`.
- request: rolls back with `WITHDRAWAL_BALANCE_CHANGED` when the claim falls
  short.
- a decision that loses the race to another → `WITHDRAWAL_ALREADY_SETTLED`: at
  the request row's guard; approve and mark_paid losing to a refusal (no
  claimed payout left) and to a recorded transfer (payouts already `paid`),
  writing nothing; mark_paid whose settle comes up short because the other
  transfer landed; a request gone. One still open keeps
  `WITHDRAWAL_HAS_INVALID_PAYOUT`, and is re-read after the transaction, not
  through it.
- `seenStatus`: a refusal sent as `requested` for a request now `approved`
  answers `WITHDRAWAL_STATUS_CHANGED` and writes nothing; one whose write loses
  to an approval answers the same, the request row written from `requested`
  only; of two racing approvals the second answers it and notifies no one.

**`withdrawals.dal.test.ts`** (new) — the SQL itself, rendered by Drizzle's
Postgres dialect:
- the balance joins `shipments` and `payments` and requires `scheduled`,
  unclaimed, `DELIVERED` and `captured`;
- settle and release require `processing`; void excludes `paid`; the claim
  requires `scheduled` and unclaimed; the request row requires `requested` or
  `approved`, or exactly the status a decision was made from.

**`shipment-cancellation.service.test.ts`** — the payout of a cancelled run is
still voided (rationale updated).

**`WithdrawalQueue.test.tsx`** (new) — *Refuse* is offered on an approved row;
there it opens a confirmation naming the amount and the driver and sends
nothing, confirming sends `reject` with `seenStatus: "approved"`, and backing
out sends nothing; on a requested row it sends `reject` with `seenStatus:
"requested"` at once, with no dialog; a refusal with
`WITHDRAWAL_HAS_INVALID_PAYOUT` toasts its own message, not the generic one,
and does not read the queue again. *Approve* sends `seenStatus: "requested"`.
`WITHDRAWAL_STATUS_CHANGED` toasts its own message, reads the queue again and
switches it to « Tous », where the request shows as approved and *Refuse*
asks first; `WITHDRAWAL_ALREADY_SETTLED` reads it again too, and the settled
request leaves the « Demandé » list.

**`Profile.test.tsx`** (new) — no Stripe card and no Stripe-status read on
`/profile`.
