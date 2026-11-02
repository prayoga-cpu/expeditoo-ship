# Plan — payment alternatives beside the card fields

**Spec:** `docs/specs/payment_alternatives_spec.md` · **Release:** 2.77.0

The owner (2026-11-02): « every payment part give alternative for
paypal/stripe besides the credit card fields ».

## Steps

1. `paymentsService.authoriseForAccept`: a new payment uses
   `automatic_payment_methods`; the saved-card lane keeps `["card"]`.
2. `AcceptPaymentDialog`: no `paymentMethodTypes` in the Elements options;
   Link on; « keep this card » only for a card; `return_url` from
   `acceptReturnUrl`; a `resume` prop and `ResumeStep`;
   `PAYMENT_NOT_AUTHORISED` worded, with « Réessayer ».
3. `useAcceptReturn` (new): reads and clears the return.
4. Callers: `JobOffers` (job page) and `ThreadOfferBubble` open the dialog on
   a return for their offer.
5. `AddPaymentMethodForm`: French, wallets, the PayPal line, a retry.
6. Copy in `messages/{fr,en}.json`.

## Dependencies

No migration, no new package. The owner switches PayPal on in Stripe (test
and live). Builds on 2.76.0 (`bff2a0f`).
