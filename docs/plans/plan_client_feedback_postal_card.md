# Plan — Foreign Postal Codes, and Paying When Accepting

**Specs:** `docs/specs/postal_codes_abroad_spec.md`,
`docs/specs/pay_at_accept_spec.md`
**Date:** 2026-09-30

Two pieces of client feedback from the same test session:

1. *"About zipcode: 4, 5 or 6 numbers (not only 5)"* — on a Brussels address.
2. *"About credit card informations, not necessary to have a registered one
   but it can be easier"* — on the dashboard banner saying a card is required
   to accept an offer.

---

## 1. Postal codes

1. `src/lib/postal-code.ts` — `JOB_POSTAL_CODE_PATTERN` (`^\d{4,6}$`) and
   `normaliseJobPostalCode` (strip non-digits, keep if 4–6).
2. `create/schemas.ts`, `listings.dto.ts` — use the pattern.
3. `expedion-escalation.service.ts` — `normalisePostalCode` delegates.
4. `admin/expedion/lib/quote-action.ts` — `hasPostalCode` delegates.
5. `expedion-report.dal.ts` — the two SQL predicates to `{4,6}`.
6. `messages/*.json` — `create.validation.postalCode`.
7. Tests beside each.

Leave `POSTAL_CODE_PATTERN` (driver-side, French) and the map clamp alone.

## 2. Pay at accept

Server:

1. `offers.dto.ts` — `acceptOfferSchema.paymentIntentId`,
   `preparePaymentSchema`, `paymentQuoteQuerySchema`.
2. `offers.service.ts` — extract `bookedSlot` and `assertMayAward` from
   `acceptOffer`; add `assertAwardable`, `paymentQuote`, `preparePayment`;
   `acceptOffer` takes `paymentIntentId`, passes it to the charge and
   releases it on failure.
3. `payments.service.ts` — `ChargeParams` gains `offerId`/`paymentIntentId`;
   `captureAuthorised` branch before mock; `savedCardSummary`,
   `quoteFee`, `createAcceptIntent`, `releaseAcceptIntent`.
4. `app/api/offers/[id]/payment/route.ts` — GET quote, POST authorise.
5. `app/api/offers/[id]/accept/route.ts` — pass `paymentIntentId`.
6. `thread-offers.service.ts` + `app/api/messages/offers/[id]/accept/route.ts`
   — accept a body with `paymentIntentId`, pass it on.
7. `lib/api-response.ts` — nothing: `OfferError`/`PaymentError` already map.

Client:

8. `features/app/offers/api/offers.api.ts` — `paymentQuote`,
   `preparePayment`, `accept(…, paymentIntentId)`.
9. `features/app/offers/ui/AcceptPaymentDialog.tsx` — quote, saved card vs
   new card, deferred Elements, 3DS, then `onConfirm(paymentIntentId?)`.
10. `listing/ui/JobDetail.tsx` + `OfferCard.tsx` — accept opens the dialog.
11. `messages/ui/ThreadOfferBubble.tsx` + `useThreadOffer` +
    `messages.api.ts` — job-lane accept opens the dialog.
12. `dashboard/ui/CardConnectBanner.tsx` + `dashboard.cardNudge` copy.
13. `messages/*.json` — `acceptPayment.*` FR + EN.

Verification: unit tests per spec §6; a real Stripe **test-mode** run of the
server lane (saved card, 3DS-required card, new card, capture, release) from a
scratch script; the dialog in Chromium, light and dark, FR and EN.
