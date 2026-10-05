# Spec — Pay When Accepting an Offer, No Saved Card Required

**Status:** implemented 2026-09-30 (2.58.0).
**Plan:** `docs/plans/plan_client_feedback_postal_card.md`
**Amends:** `payment_at_booking_spec.md` §2.2 (the `stripe` lane) and §4
(already stale: posting stopped requiring a card in `ce0388f`).

---

## 1. What this is

The client, on the dashboard banner that read *"Ajoutez une carte pour accepter
des offres … vous ne pourrez pas accepter une offre tant que vous n'en avez pas
ajouté une"*:

> About credit card informations, not necessary to have a registered one but
> it can be easier.

Until now a direct job's owner could not accept a bid without a card saved in
advance: `chargeForShipment` charged the saved card off-session after the award
and, finding none, threw `PAYMENT_METHOD_REQUIRED` and undid the award.

Now accepting opens a payment step:

- **A saved card** is one tap — *Payer avec Visa •••• 4242*.
- **No saved card, or "Une autre carte"** shows the card form in place, with
  *Enregistrer cette carte pour mes prochaines réservations* (unticked).

The money is still taken at booking (`payment_at_booking_spec.md`). What moves
is *where the card comes from* and *who is present*: the requester is at the
keyboard, so the charge is **on-session** and a 3-D Secure challenge is shown
to them instead of failing the charge.

## 2. Who sees the payment step

| Accepting | Step |
|---|---|
| Owner of a `direct` job, `MOCK_PAYMENTS` off | Payment (§3) |
| Owner of a `direct` job, `MOCK_PAYMENTS` on (local dev, beta seed — never production) | Confirmation only, "Mode test : aucune carte n'est débitée" |
| Operator/admin on an `expedion` job | Confirmation only, "Le client a déjà payé ce transport sur Expedion" |
| A carrier taking an escalated job (`takeJob`), `assignDirect` | No dialog; unchanged. Both are `expedion` jobs, recorded rather than charged. Since 2.60.0 a direct job cannot be taken (`TAKE_NOT_AVAILABLE`, `take_job_spec.md`); until then a take charged the requester's **saved** card off-session, and with none failed `PAYMENT_METHOD_REQUIRED` and stayed a pending bid |
| Standalone thread offer (no job) | No dialog; no money moves, unchanged |

Surfaces: the offer cards on `/listing/[id]` and the accept button in a
job-lane thread offer bubble. `/admin/awards` is unchanged.

## 3. The flow

```
open dialog ──► GET  /api/offers/:id/payment?slotId=   quote (read-only)
pay        ──► POST /api/offers/:id/payment            PaymentIntent, manual capture
               └ saved card: confirmed on the server; 3DS → stripe.handleNextAction
               └ new card:   stripe.confirmPayment(elements, clientSecret)
            ──► POST /api/offers/:id/accept { slotId, paymentIntentId }
               commitAward → capture → payments row `captured`
```

The card is **authorised before** the award and **captured right after** it.
Nothing is ever awarded against money that is not there, and nothing is taken
for an award that did not happen.

### 3.1 `GET /api/offers/:id/payment` — the quote

Session required. Runs the award's own checks (§4) without writing anything —
no Stripe customer is created (`findCustomer`, never `getOrCreateCustomer`).

```ts
{
  required: boolean;
  reason: "charge" | "mock" | "prepaid";
  priceCents: number;        // the offer
  platformFeeCents: number;  // 0 on "prepaid"
  totalCents: number;        // what the card is debited now
  savedCard: { brand: string; last4: string } | null;  // null unless "charge"
}
```

### 3.2 `POST /api/offers/:id/payment` — authorise

Body (`preparePaymentSchema`):

```ts
{ method: "saved" | "new"; saveCard?: boolean; slotId?: string }
```

Owner of a `direct` job only, and only with `MOCK_PAYMENTS` off; otherwise
`PAYMENT_NOT_REQUIRED` (409). Runs §4 again. Creates the Stripe customer if
the user has none.

A PaymentIntent is created with:

- `amount` = offer price + platform fee (the admin-set rate, read now),
  `currency: "eur"`, `payment_method_types: ["card"]`,
- `capture_method: "manual"` — held for the seconds between authorisation and
  award, then captured,
- `metadata: { purpose: "offer_accept", offerId, listingId, shipperId,
  platformFeeCents }` — what the accept checks it against (§3.3),
- no `off_session`.

| `method` | Extra | Returns |
|---|---|---|
| `saved` | `payment_method` = first saved card, `confirm: true` | `requires_capture` → ready; `requires_action` → `clientSecret` for `handleNextAction` |
| `new` | `setup_future_usage: "off_session"` when `saveCard` | `clientSecret` for `confirmPayment` |

`saved` with no saved card → `PAYMENT_METHOD_REQUIRED` (402). A bank refusal
on a saved card → `PAYMENT_DECLINED` (402).

The new-card form uses Elements in deferred mode (`mode: "payment"`, the quote's
`totalCents`, `captureMethod: "manual"`, `paymentMethodTypes: ["card"]`,
`setupFutureUsage` following the checkbox), so the intent is created only when
the requester presses Pay — opening and closing the dialog creates nothing.

### 3.3 `POST /api/offers/:id/accept` with `paymentIntentId`

`acceptOfferSchema` gains optional `paymentIntentId` (`pi_…`). With it, a
`stripe`-source charge no longer charges a saved card; it captures that intent:

1. Retrieve it. `metadata.offerId`, `listingId` and `shipperId` must match the
   award, and `amount` must equal the offer price + `metadata.platformFeeCents`
   — otherwise `PAYMENT_INTENT_MISMATCH` (409).
2. `status` must be `requires_capture` — otherwise `PAYMENT_NOT_AUTHORISED`
   (402). The requester closed the 3-D Secure window, say.
3. Insert the `payments` row `pending` with the intent id and the fee from the
   metadata (the rate the requester was shown, not one changed since).
4. Capture. `succeeded` → `captured` + `capturedAt` → receipt (`afterCapture`).
   Anything else → `failed`, `PAYMENT_CHARGE_FAILED` (402).

This branch sits **before** the mock branch: a real `pi_…` stays real while
`MOCK_PAYMENTS` is on (the invariant `mock-payments.ts` already states).

Without `paymentIntentId` the existing lanes are unchanged: `expedion` records,
mock mocks, and a direct job with a saved card is charged off-session.

> **Amended (2.60.0) by `take_job_spec.md`.** No screen reaches that last
> branch any more. Its one UI caller was a carrier taking a direct job, which
> is now refused; the dialog sends an intent whenever a charge is due. It
> answers only an accept the requester sends through the API with no intent,
> and stays because §6 pins it.

### 3.4 Releasing an authorisation that was not used

If the accept fails **after** the permission check — the offer was withdrawn,
another bid won, the carrier was suspended, the capture failed — the intent is
cancelled so the requester's bank releases the hold at once rather than after
seven days. Two guards:

- Only an intent whose `metadata.offerId` and `shipperId` are this award's is
  touched, so nobody can cancel someone else's intent by naming it.
- Not when this very offer is already the listing's accepted one: that is a
  double-submit racing its own first request, which is capturing the intent.

Release never throws; a failure is logged.

**A second card for an award that already happened.** A re-accept of an offer
that has already won returns `alreadyAccepted` as before. If it names an
intent, and the award's payment is on record under a *different* intent, the
one just sent is spare and is released (`releaseSupersededIntent`). That is
the requester who paid again because the first accept's answer never reached
them. With no payment row yet, or the same intent id, nothing is released: it
may be a double-submit whose first request is still capturing that intent.

**A chat offer the thread itself refuses.** The dialog authorises against the
bid, and on the job lane the bid stays pending after the recipient declined
the thread offer. `threadOffersService.accept` refuses that at its own gate
(`OFFER_NOT_PENDING`), before `acceptOffer` is reached, so it releases the
card itself (`releaseRefusedIntent`: this bid, this user, still unused). The
bubble closes the door first: a recipient who declined sees « Refusée » and no
buttons, while the sender's card is unchanged because their bid is still live.

### 3.5 The dialog (`AcceptPaymentDialog`)

- **Not modal.** A Radix modal sets `pointer-events: none` on `<body>` and its
  focus trap pulls focus back from anything outside the dialog. Stripe mounts
  the 3-D Secure challenge outside it, so a real bank's code entry would be
  unusable. The dialog is `modal={false}` with its own backdrop, refuses
  outside interaction rather than closing mid-payment, and cannot be closed
  while a payment is in flight.
- **Deferred Elements** (`mode: "payment"`, the quote's total,
  `captureMethod: "manual"`, `paymentMethodTypes: ["card"]`). The intent is
  created when Pay is pressed, so opening and closing the dialog creates
  nothing at Stripe. `setupFutureUsage` follows the checkbox, and must: Stripe
  refuses a confirmation where the intent and the Elements group disagree.
- **Link off** (`wallets.link: "never"`). Its own "save my details" sign-up
  rendered under the card fields and read as a second, different way of
  keeping the card, next to ours.
- **Apple Pay and Google Pay off** (`wallets.applePay` / `googlePay:
  "never"`). Production takes real money, and only the typed-card form was
  verified. Turning them on is a separate, tested change.
- **The save box starts unticked.** Keeping a card is the requester's choice.
  Ticked, Stripe's own mandate text appears ("vous autorisez Expeditoo à
  débiter votre carte pour les paiements futurs…").
- In test mode the fee is still shown, so the bottom line reads *Total, non
  débité* rather than *Montant de l'offre*.
- **What a failed accept is allowed to say.** A typed 4xx from the accept
  means the award did not happen and the card was released, so the dialog says
  *L'offre n'a pas été acceptée et votre carte n'a pas été débitée* (or, on a
  step that took no card, only the first half). Anything else — a dropped
  connection, a timeout, a 5xx — leaves the outcome unknown: the accept
  awards, captures, renders the receipt and emails it in one request, and a
  function that dies after the capture has debited the card. The dialog then
  says the card *may* have been debited, refetches every query so the page
  behind shows the truth, and offers only *Fermer*.

## 4. The checks run before a card is touched

Shared by the quote, the authorisation and the accept (`assertAwardable`):

| Check | Code |
|---|---|
| Offer exists | `OFFER_NOT_FOUND` 404 |
| `slotId` is one of the offer's, and not in the past | `SLOT_NOT_ON_OFFER` 400, `SLOT_IN_PAST` 409 |
| Listing exists | `LISTING_NOT_FOUND` 404 |
| Actor is the owner, or operator/admin on an `expedion` job | `FORBIDDEN_NOT_SHIPPER` / `FORBIDDEN_NOT_OPERATOR` 403 |
| Offer is `pending` | `OFFER_NOT_PENDING` 409 |
| Listing is `open` and not awarded | `LISTING_NOT_OPEN` 409 |
| Both ends have coordinates | `COORDINATES_REQUIRED` 422 |
| Carrier still approved | `CARRIER_NO_LONGER_APPROVED` 409 |

The quote and the authorisation refuse early so a card is never authorised for
an award that `commitAward` would refuse; `commitAward` still re-checks inside
its lock, which remains the only concurrency guarantee.

## 5. Copy

- Dashboard banner (`dashboard.cardNudge`): *Enregistrez une carte pour aller
  plus vite* — "Vous paierez au moment d'accepter une offre, en saisissant
  votre carte. Une carte enregistrée vous permet de le faire en un clic." It
  no longer says you cannot accept without one.
- Dialog (`acceptPayment.*`), FR and EN, including every error code above.

## 6. Test coverage required

`offers.service` / `payments.service`:

- quote: `charge` with fee and saved card; `mock`; `prepaid` for an operator
  on an escalated job; refuses a non-owner; refuses a non-pending offer
- authorise `saved`: confirms on-session with the saved card, manual capture,
  metadata; `requires_action` returns a client secret; no card →
  `PAYMENT_METHOD_REQUIRED`; a card error → `PAYMENT_DECLINED`
- authorise `new`: no confirm; `setup_future_usage` only when `saveCard`
- authorise refuses an `expedion` job and mock mode with `PAYMENT_NOT_REQUIRED`
- accept with an intent: captures it and never lists saved cards; row carries
  the metadata fee; mismatch on offer / shipper / amount →
  `PAYMENT_INTENT_MISMATCH`; not `requires_capture` → `PAYMENT_NOT_AUTHORISED`;
  a real intent is captured even with `MOCK_PAYMENTS` on
- accept failure after the permission check cancels the intent; a
  `LISTING_ALREADY_AWARDED` for this same offer does not; a forbidden actor
  never cancels
- the existing saved-card off-session lane still works without an intent

- a re-accept of an offer that already won releases a different intent, and
  leaves alone the one the award was paid with, or any intent while no payment
  row exists

- a chat accept refused at the thread's own gate releases the card; nothing is
  released with no intent, on the standalone lane, or when the accept succeeds

UI (`ThreadOfferBubble.test.tsx`): Accept on a job-lane offer opens the dialog
for the bid behind it; a standalone offer accepts at once; a recipient who
declined sees their answer and no buttons, the sender's card is unchanged, and
the bid's status still wins once somebody has decided it.

Dialog (`AcceptPaymentDialog.test.tsx`, Stripe stood in for): the fee and
total are shown before paying; the saved card pays and hands its intent to the
accept; "not debited" appears only on a typed refusal; a dropped connection, a
504 and a 500 each say the outcome is unknown, remove Pay and refetch; a
declined saved card leads to the card form with the save box unticked; the
no-card steps never mention a card; a quote failure is said in words.

The card form itself is verified in Chromium against Stripe test mode, not
jsdom: new card saved, saved card in one tap, a 3-D Secure card with the
challenge completed (typed, and again from saved), and the test-mode confirm
step.

## 7. Known limits

- An authorisation made in the dialog and then abandoned (tab closed before the
  accept call) is released by the bank after about seven days, not at once.
- A capture that succeeds at Stripe but whose response is lost is compensated
  like any other failed charge, and nothing here records the money: the
  `payment_intent.succeeded` webhook ignores this intent because it carries no
  `transfer_group`. It is findable at Stripe by its `offerId` metadata, and it
  needs a human either way — the off-session charge had the same exposure.
- **A job posted with a typed address still cannot be awarded**
  (`COORDINATES_REQUIRED`, 2.50.0): a shipment needs a real point to navigate
  to. The dialog now says so in words at the quote, before any card is asked
  for, instead of the raw code the accept used to toast. A foreign address can
  only be typed (the map is France-only, `postal_codes_abroad_spec.md` §3), so
  a Brussels job typed by hand is posted and bid on but not awardable.
- **Verified in Stripe test mode only.** Production runs the real path with a
  live key: `MOCK_PAYMENTS` is unset in Vercel, and `env-assertions.ts`
  refuses to boot production with it on or with a key that is not `sk_live_`.
  So this dialog takes real money there, and no live-mode run exists — no
  laptop can reach production's keys. Production had never taken a real
  payment when this shipped (its 3 payment rows were beta-seed mocks), so the
  first real accept is the first live charge. `STATUS.md` → Operator to-do
  asks for one real accept-and-cancel.
- The live publishable key in Vercel must pair with the live secret key. A
  mismatch fails at the card form, and nothing in the repo can check it.
- The test-mode confirm step shows only where `MOCK_PAYMENTS` is on: local
  development and the beta seed (`docs/TESTING_MOCKS.md` §1).
