# Plan — payment polish (2.99.3)

Spec: `docs/specs/payment_polish_2_99_3_spec.md`. Release: patch, tag `fix`.

1. **Once-only return** — `AcceptPaymentDialog.tsx`: module-level `finishOnce`
   keyed by PaymentIntent id; `ResumeStep` attaches to it.
2. **Stale intents** — `payments.service.ts`: `cancelStaleAcceptIntents`, called
   at the top of `authoriseForAccept`; only `requires_payment_method`, only this
   requester's intents for this offer, contained.
3. **Card next step** — `StripeStepError.cardRefused` from Stripe's `card_error`;
   `useErrorMessage` appends `acceptPayment.errors.cardNextStep` (en + fr).
4. **`transfer_group`** — no code; recorded in the spec so it stays as designed.
5. **Connect origin** — `appUrl()` in `stripe.service.ts` and
   `connect/return/route.ts`.
6. Tests per the spec; CHANGELOG.md + CHANGELOG.fr.md, STATUS.md, version in
   `package.json` and `src/lib/version.ts`; gates one at a time.

Files: the five above, `messages/en.json`, `messages/fr.json`, four test files.
No schema, no migration, no new endpoint, no environment variable.
