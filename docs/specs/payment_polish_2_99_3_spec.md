# Payment polish after the first live payment (2.99.3)

Status: implemented 2026-11-26. Plan: `docs/plans/plan_payment_polish.md`.

## 0. Where this came from

On 2026-11-26 a real €1.10 payment was taken on production through the accept
dialog, refunded by cancelling, and the 31 October €1 job was cancelled and
refunded the same way (STATUS 2.99.3). The live path was clean. The same pass,
run against Stripe test mode in a browser, found five smaller things. Four are
changed here; one is left as it is, on purpose, and written down so nobody
« fixes » it later.

Nothing here changes what a requester is charged, when, or how a refund works.

## 1. A return from PayPal finishes the award once, whoever mounts

**Symptom.** After a payment that left the page (PayPal) and came back, the
browser sent `POST /api/offers/:id/accept` twice, about 140 ms apart. The
second answered « already accepted » (200). One payment, one shipment, one
invoice — but a once-only guard that does not hold.

**Cause.** `ResumeStep` guarded with a `useRef`. Finishing the award re-reads
the offers; the card behind the dialog is rebuilt; a second `AcceptPaymentDialog`
mounts while the return's parameters (`acceptOffer`, `payment_intent`) are still
in the address. A new instance has a new ref.

**Behaviour.**
- The accept call for an approved payment is made once **per page load**,
  keyed by the PaymentIntent id (`finishOnce`, module scope).
- Every instance that mounts for that intent attaches to the same promise and
  shows its outcome: success closes the dialog; a refusal shows the same
  refusal and next steps. None asks the server again.
- « Réessayer » still goes back to the form (`resumeDone`); it never re-runs
  the return.
- A reload starts afresh, and the server stays idempotent
  (`acceptOfferForCaller` answers « already accepted »), as before.

## 2. A declined attempt no longer leaves an intent behind

**Symptom.** Every press of Pay creates a PaymentIntent. A declined card, or a
3-D Secure challenge that failed or was walked away from, left it at
`requires_payment_method`; the next attempt left another. Six attempts, six
intents in the Dashboard. Never capturable, never money — but support reads
them as failed payments.

**Behaviour.** `paymentsService.authoriseForAccept` first lists the customer's
most recent intents (20) and cancels those that are all of:
- `status === "requires_payment_method"`,
- `metadata.purpose === "offer_accept"`,
- `metadata.offerId` equal to this offer and `metadata.shipperId` equal to this
  requester.

Then it creates the new one. This covers both lanes (a typed card and a saved
card that was declined at confirmation).

**Never touched:** `requires_capture` (money held), `requires_action` (a
challenge under way), `processing`, `succeeded`, another offer's, another
requester's, anything without the accept marker (an Expedion Checkout intent).

**Contained.** A failed list or cancel is logged and the payment goes ahead.

**Limit.** The last abandoned attempt of a dialog the requester closes stays
until they pay for that offer again or Stripe ages it out; one, not one per
press. Two browser tabs paying for the same offer at once would cancel each
other's unconfirmed intent — paying the same offer twice at once is not a
journey.

## 3. A refused card says what to do next

**Symptom.** In the card form a refusal showed Stripe's own sentence
(« Votre carte a été refusée. ») with nothing after it. The French
`PAYMENT_DECLINED` next step (« Essayez une autre carte ») existed only for the
saved-card path.

**Behaviour.** A failure Stripe.js classifies `card_error` — declined, expired,
wrong code, failed 3-D Secure — is shown as Stripe's sentence followed by
`acceptPayment.errors.cardNextStep`: « Essayez une autre carte ou un autre
moyen de paiement. » / « Try another card or another payment method. » The form
stays in place, so the next step is something to do right there. Any other
failure keeps Stripe's wording as it was.

## 4. `transfer_group` on an accept intent: unchanged, deliberately

The test run observed that app-created intents carry `transfer_group: null` at
Stripe while `payments.transfer_group` is filled, so the webhook's
`payment_intent.succeeded` branch (`if (transferGroup) captureByIntent`) never
runs for them. That is the design (`captureAuthorised`, `payments.service.ts`):
the accept path captures synchronously and settles the row itself, and a
transfer group on the intent would make the webhook race it. The live payment of
2026-11-26 confirmed the webhook still arrives (heartbeat 0.8 s after capture)
and does no harm. The group on a **payout** is read from the database row, not
from Stripe. No change.

## 5. Connect redirects never fall back to localhost

`stripe.service.ts` (the onboarding link's `refresh_url` and `return_url`) and
`api/stripe/connect/return/route.ts` read `NEXT_PUBLIC_APP_URL` at import time
and fell back to `http://localhost:3000`. A deployment without the variable
would have sent a driver who had just finished onboarding to a laptop address.
Both now call `appUrl()` at request time, whose fallback is the production
origin and which strips a trailing slash. Production has the variable set, so
nothing changes there today.

## Test coverage required

- `AcceptPaymentDialog.test.tsx`: accept called once when a second dialog
  mounts for the same return; the second shows the first's refusal without a
  second call; a `card_error` shows Stripe's sentence plus the next step and
  keeps the form; any other error shows Stripe's wording alone.
- `payments.service.test.ts`: cancels this requester's unused intents for this
  offer on both lanes; leaves held, in-challenge, processing, succeeded,
  other-offer, other-requester and unmarked intents alone; a failed list or a
  refused cancel never stops the payment.
- `stripe.service.test.ts` and `connect/__tests__/return-origin.test.ts`: the
  three addresses are the production origin when the variable is unset, the
  deployment's own origin (no doubled slash) when it is set.
- Not unit-testable here, verified in a browser against Stripe test mode on
  2026-11-26 before the change and unchanged by it: 3-D Secure frame, PayPal
  return, Elements.
