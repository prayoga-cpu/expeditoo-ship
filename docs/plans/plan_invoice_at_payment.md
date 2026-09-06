# Implementation Plan: Invoicing at payment

**Spec:** `docs/specs/invoice_at_payment_spec.md`
**Amends:** `docs/specs/billing_documents_spec.md` §4.1, §6.2, §7
**Date:** 2026-09-05

## Overview

The client asked for one thing: *after payment, automatically generate an
invoice that can be sent by email or downloaded.*

Downloading already works. The other two halves do not:

1. **The invoice is not raised after payment.** It is raised on **delivery**,
   from `settleDelivery` (`shipment.service.ts`), which is days later. The
   client pays at booking (`payment_at_booking_spec.md`), so today they are
   debited and then wait for the goods to arrive before any document exists.
2. **Nothing emails the document.** `sendInvoiceReadyEmail` mails a hardcoded
   English `<h1>` with a *link* to the profile screen and no attachment, and it
   is the only email path — there is no way to ask for the invoice again.

Moving issuance earlier is not a one-line move, because a document that exists
before delivery can be invalidated by things that happen after it: refunds,
cancellations, revoked awards. So this plan carries the correction path with it.

## Prerequisites

None. No new service, no new dependency — `resend@6.5.2` already types
`attachments`, and `@react-pdf/renderer` already renders the document.

## Implementation steps

### 1. One writer for `captured`

**Files to modify:**
- `src/server/services/payments.service.ts`
- `src/server/services/stripe.service.ts`

`status: 'captured'` is written in four places today: three inside
`chargeForShipment` and one bare `db.update` in the Stripe webhook, which sets
no `capturedAt` and has no status predicate (so a retried
`payment_intent.succeeded` can flip a *refunded* row back to captured).

Add `captureByIntent` / `markRefunded` as the guarded transitions, route the
webhook through the first, and funnel every settled row through one
`afterCapture` hook. This is what makes "after payment" mean *every* payment
rather than *every award*.

### 2. Issue the document at capture, not at delivery

**Files to modify:**
- `src/server/services/payments.service.ts` (the hook, in its own try)
- `src/server/services/shipment.service.ts` (keep the delivery call as a backstop)

Predicated on `payment.source === 'stripe'`. An escalated job's client was
debited by Expedion, in Expedion's Stripe account, against a listing owned by a
system account nobody signs into — see spec §3.

### 3. Numbering that survives concurrency and deletion

**Files to create:**
- `src/db/migrations/0019_invoice_documents.sql`
- `src/db/schema/document-sequences.ts`

**Files to modify:**
- `src/db/schema/invoices.ts`, `src/db/schema/index.ts`
- `src/db/migrations/meta/_journal.json` (idx 18, `when` > 1788094800000)
- `src/server/dal/invoices.dal.ts`

`count(*) + 1` against a UNIQUE column, in a separate statement from the insert.
Two concurrent awards produce the same string and the loser gets a 23505; delete
any non-highest row and the count re-derives a number already used. Replaced by
a per-(series, year) counter row allocated in the same transaction as the insert.

Same migration adds `kind`, `related_invoice_id`, the frozen billing block, and
a partial unique index on `payment_id` for `kind = 'invoice'`.

### 4. The correction: an avoir

**Files to modify:**
- `src/server/dal/invoices.dal.ts`, `src/server/services/invoices.service.ts`
- `src/server/services/payments.service.ts`, `src/server/services/refund.service.ts`

An issued, emailed invoice is corrected by a credit note, not by mutation. Minted
from the single `captured → refunded` transition so both refund writers reach it.

### 5. The document itself

**Files to create:**
- `src/lib/invoice-issuer.ts`
- `src/server/emails/InvoiceDocumentEmail.tsx`

**Files to modify:**
- `src/server/pdf/InvoicePDF.tsx`, `src/lib/invoice-pdf-props.ts`
- `.env.example`

French, and titled by what it can prove: **Facture** when the issuer's legal
identifiers and VAT position are configured, **Reçu de paiement** when they are
not — the distinction `billing_documents_spec.md` §3.3 already draws for the
carrier's relevé. Never the PAYÉ stamp on a `pi_mock_` charge.

### 6. Email with the document attached

**Files to modify:**
- `src/server/dto/email.dto.ts`, `src/server/services/email.service.ts`
- `src/server/services/invoices.service.ts`

`@react-pdf/renderer` is loaded with a dynamic `import()` so it does not enter
the import graph of every route that reaches `api-response.ts`.

### 7. Ask for it again

**Files to create:**
- `src/app/api/user/invoices/[id]/email/route.ts`
- `src/features/app/profile/api/invoices.api.ts`

**Files to modify:**
- `src/app/api/user/invoices/[id]/pdf/route.ts` (stop calling the DAL directly)
- `src/features/app/profile/hooks/useInvoices.ts`
- `src/features/app/profile/ui/invoices/InvoiceList.tsx`
- `src/features/app/profile/api/index.ts`
- `messages/fr.json`, `messages/en.json`

### 8. Typed errors

**Files to modify:**
- `src/server/services/invoices.service.ts`

Three bare `new Error(...)` throws, one of which is an authorisation failure that
`handleError` cannot translate — the new route would answer 500 where it means
403. `InvoiceError` is already registered in `api-response.ts`.

### 9. The contract the document contradicts

**Files to modify:**
- `messages/fr.json`, `messages/en.json` (`marketing.terms` §Paiement)

The public terms still say funds are *blocked* at award and debited on delivery.
That stopped being true when payment-at-booking shipped; it becomes indefensible
the moment the platform mails each client a receipt saying otherwise.

## Verification

```bash
npx tsc --noEmit
pnpm lint
pnpm test
```

New suites: `src/server/services/__tests__/invoice-capture-hook.test.ts`,
`src/server/dal/__tests__/invoices.dal.test.ts`,
`src/lib/__tests__/invoice-document.test.ts`,
`src/server/pdf/__tests__/invoice-render.test.ts` (renders the real PDF),
`src/app/api/user/invoices/[id]/email/__tests__/route.test.ts`,
`src/app/api/user/invoices/[id]/pdf/__tests__/route.test.ts`, and
`src/server/services/__tests__/stripe-webhook-capture.test.ts`, plus a rewritten
`invoices.service.test.ts`.

The migration is applied for real against local `expeditoo_dev`
(`pnpm db:start && pnpm db:migrate`) rather than trusted: it is hand-written and
nothing else executes it before the deploy does.

Then **Actions → Migrate database** before the deploy: the Vercel build is a
plain `next build` and never migrates.

## Notes

Deliberately not decided here, because they are not code decisions:

- **The issuer's legal identifiers and VAT position.** Every mentions-légales
  field is still `TODO(EXPEDITOO-LEGAL)`. The document reads them from env and
  downgrades its own title when they are missing, so filling them promotes every
  future document with no code change.
- **The commission split** (`ROADMAP.md` §10). The invoice bills the client the
  job price; what the platform keeps of it is a separate ledger question.
