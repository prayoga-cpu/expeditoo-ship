# Spec — payment alternatives beside the card fields

**Plan:** `docs/plans/plan_payment_alternatives.md` · **Release:** 2.77.0

**Asked by the owner (2026-11-02):** « also every payment part give
alternative for paypal/stripe besides the credit card fields ».

**Money:** production takes real payments (`MOCK_PAYMENTS` is refused there).
Everything below was verified against Stripe **test** mode only.

## 1. What the requester sees

The accept dialog's payment form (`AcceptPaymentDialog`, job page and chat
bubble) offers, beside the card fields:

- **Link** — Stripe's own saved-details checkout (`wallets.link: "auto"`,
  off until 2.77.0);
- **PayPal** — once the owner switches it on in Stripe (§5);
- **Apple Pay / Google Pay** — unchanged, where the device and the registered
  domain allow them;
- and any other method the owner switches on in the Stripe Dashboard that can
  hold money until capture.

« Enregistrer cette carte » is shown only while **card** is the chosen method,
and is cleared when another method is chosen: only a card is kept for a later
one-tap payment. A PayPal account cannot be charged later without PayPal's own
billing agreement.

## 2. Which methods — the Dashboard decides

- `authoriseForAccept` with `method: "new"` creates the intent with
  `automatic_payment_methods: { enabled: true }` and **no** method list; the
  form's Elements options carry no `paymentMethodTypes` either. Stripe offers
  what the Dashboard has switched on, filtered to what supports
  `capture_method: "manual"` and EUR. On the test account on 2026-11-02 that
  was `["card", "link"]`.
- Turning a method off in the Dashboard therefore cannot break a payment here,
  and turning PayPal on needs no release.
- `method: "saved"` stays `payment_method_types: ["card"]`: it confirms
  server-side against a saved card, and a method that redirects would have
  nowhere to send the requester.
- `setup_future_usage: "off_session"` is still set only when the box is
  ticked, and the form sends the same value, so Stripe offers only methods
  that can be kept while it is.
- Capture, release, refund, the receipt and the payout are unchanged: none of
  them reads card details, and each works on the intent.

## 3. Methods that leave the page — PayPal

PayPal approves on its own site. `confirmPayment` is given a return address
(`acceptReturnUrl`): this page plus `acceptOffer` and `acceptSlot`; Stripe
adds `payment_intent`, `payment_intent_client_secret` and `redirect_status`.

On return, `useAcceptReturn` reads those and the caller that renders that
offer's dialog — `JobOffers` on the job page, `ThreadOfferBubble` in a chat —
opens it on `resume`:

- **approved** (`redirect_status` not `failed`, `requires_payment_method` or
  `canceled`): the dialog shows « Finalisation de la réservation… » and calls
  the accept with the intent **once** (a ref guards re-renders). Success
  closes it; the server still checks the intent belongs to this award and is
  held for capture (`authorisedFeeFor`).
- **not approved**: « Le paiement n'a pas été approuvé. Réessayez, avec ce
  moyen de paiement ou un autre. » with « Réessayer », which returns to the
  form, and « Fermer ».
- A server refusal goes through the same next steps as a Pay press
  (`no_dead_ends_spec.md` §1). `PAYMENT_NOT_AUTHORISED` — nothing held —
  offers « Réessayer ».
- Closing the dialog drops the return's parameters with
  `history.replaceState` (the app router follows it), keeping the rest of the
  query, so a reload does not try again.

## 4. Saving a card — `/profile/payment-methods/create`

Stays a card-only SetupIntent: a kept method is charged later as a card.
Apple Pay and Google Pay are offered (`wallets: auto`), and a line says PayPal
is chosen when paying for a transport and is not saved here. The page is now
in French; a failed setup intent was « refresh the page », in English, and is
now `LoadErrorState` with « Réessayer » and « Mes moyens de paiement ».

## 5. Owner to-do

- Stripe → **Settings → Payment methods → PayPal → Turn on**, in **test** and
  in **live** mode. Until then PayPal does not appear, and nothing breaks.
- If PayPal is on and still does not appear, Stripe has filtered it out:
  only methods that can hold the money until the transporter is confirmed are
  offered.

## Known limits

- The redirect return was verified with a real test-mode intent approved
  server-side, not through PayPal's own site (not switched on in the test
  account). The PayPal leg proper needs one test-mode run once it is on.
- With Link on, Stripe shows its own optional « save my details with Link »
  inside the card form, beside our « keep this card » box. They are different
  things — Link across Stripe merchants, ours for a one-tap payment here.

## Test coverage required

- Server: a new payment names no method and enables automatic methods; the
  saved card still names `card`.
- Dialog: a return finishes the award once without asking again; a cancelled
  return says so and the form comes back; `PAYMENT_NOT_AUTHORISED` offers
  « Réessayer ».
- `useAcceptReturn`: the return address keeps the tab and drops an earlier
  return; reading outside the app router; `clear` keeps the rest.
- Once against Stripe test mode: a card through the Dashboard-driven form is
  captured; a return with a real held intent is awarded and captured.
