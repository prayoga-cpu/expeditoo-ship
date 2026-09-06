# Specification: Invoicing at payment

**Plan:** `docs/plans/plan_invoice_at_payment.md`
**Amends:** `docs/specs/billing_documents_spec.md` §4.1, §6.2, §7
**Related:** `payment_at_booking_spec.md`, `offers_engine_spec.md`
**Date:** 2026-09-05

---

## 1. Overview

> *After payment, automatically generate an invoice that can be sent by email or
> downloaded.*

Downloading has worked since `billing_documents_spec.md`. The other two halves
did not.

**The document was raised on delivery, not on payment.** `settleDelivery` called
`invoicesService.createFromPayment` after the goods arrived — a wire written when
the money was captured on delivery. The client now pays **at booking**
(`payment_at_booking_spec.md`), so the sequence was: card debited on Monday,
document issued on Thursday, if the job completed at all. A charge with no
document for three days is the thing a receipt exists to prevent.

**Nothing emailed the document.** `sendInvoiceReadyEmail` sent an English
`<h1>Your invoice is ready</h1>` with a link to `/profile/invoices` and no
attachment, and it fired only from creation — a client who lost the mail had no
way to ask for it again.

Moving issuance earlier is the whole change, and it is not a one-line move: a
document that exists *before* delivery can be invalidated by what happens after
it. §5 is that consequence, and it is not optional.

## 2. The single capture event

`payments.status = 'captured'` was written from four places:

| Writer | File | What it did |
|---|---|---|
| `recordExternalCharge` | `payments.service.ts` | insert, `source='expedion'` |
| `mockChargeForShipment` | `payments.service.ts` | insert, synthetic `pi_mock_` intent |
| real Stripe branch | `payments.service.ts` | update after a succeeded PaymentIntent |
| `payment_intent.succeeded` | `stripe.service.ts` | bare `db.update`, **no `capturedAt`, no status predicate** |

The fourth mattered. `chargeForShipment` stamps the intent id onto a **failed**
row when the intent comes back non-`succeeded`, so a later
`payment_intent.succeeded` — an async-settling intent, or a Stripe retry — turned
that row `captured` outside every service, scheduled a payout, set no
`capturedAt`, and produced no document. With no status predicate it could also
turn a **refunded** row back into a captured one.

Two things change. The three writes inside `chargeForShipment` stay where they
are — they are inserts, and an insert of a settled row is not a transition — but
each now hands its row to `afterCapture`, the one place the document is raised.
The webhook stops writing the row at all and calls
`paymentsService.captureByIntent(intentId)`, which refuses anything but
`pending → captured` and `failed → captured`, stamps `capturedAt`, clears the
stale failure reason, and hands the row to the same `afterCapture`.

**`afterCapture` runs inside `chargeForShipment`, and therefore inside
`acceptOffer`'s charge `try`.** That is only safe because it cannot throw: the
issue is wrapped in its own `try` that logs and returns. It matters, because that
`try`'s `catch` calls `compensateFailedAward`, which returns the job to the board
**without refunding** — it only ever ran on a charge that failed. A paperwork
failure that escaped would un-award a job whose client has already been debited,
so the containment is the guarantee, not the call site.

## 3. Which payments are invoiced

**Only `payment.source === 'stripe'`.**

An escalated job's client accepted a quote and paid **in Expedion**, into
Expedion's Stripe account, before this repo had a listing. `recordExternalCharge`
records that money; it does not receive it. The row's `userId` is
`listing.shipperId`, which for an escalated listing is `EXPEDION_SYSTEM_USER_ID`
— an account no human signs into.

An Expeditoo invoice for that payment would assert, on one page: a charge this
company did not make, to a party that is not a person, dated the day an operator
awarded rather than the day the client paid, for the winning driver's bid rather
than the amount the client actually paid Expedion. And it could never be
corrected — `refundForJob` throws `REFUND_NOT_LOCAL` before any correction
could be minted, so a cancelled escalated job would leave the document standing
forever.

This is `billing_documents_spec.md` §4.1's own reasoning ("the Expedion client
was invoiced by Expedion, not here") followed to its conclusion. That section
said the row was written but unseen; it is now not written at all.

`payments.source` decides this, not `listings.origin` (CLAUDE.md gotcha 4).

## 4. What the document says

### 4.1 Its title is what it can prove

Every legal identifier of the operating company is still `TODO(EXPEDITOO-LEGAL)`
— `/legal-notice` renders SIRET, RCS, forme juridique, capital and VAT number as
*À COMPLÉTER* — and nobody has stated Expeditoo's VAT position. A document headed
**Facture** carrying none of those is not a facture; it is a non-conforming
document making a claim it cannot support.

`src/lib/invoice-issuer.ts` reads the issuer from the environment:

```
INVOICE_ISSUER_NAME, INVOICE_ISSUER_LEGAL_FORM, INVOICE_ISSUER_ADDRESS,
INVOICE_ISSUER_SIRET, INVOICE_ISSUER_RCS, INVOICE_ISSUER_VAT_NUMBER,
INVOICE_ISSUER_EMAIL, INVOICE_VAT_RATE   # percent, "0" means exempt
```

- **All of them present** → the document is titled **Facture**, prints the
  identity block and the VAT treatment, and totals as HT / TVA / TTC.
- **Any of them missing** → the same document, same data, titled **Reçu de
  paiement**, footed with the wording already used on the carrier's document:
  *« Reçu de paiement — document récapitulatif, ne vaut pas facture. »*

One continuous `INV-<year>-NNNN` series either way. Filling the mentions légales
promotes every document issued from that moment with no code change; nothing is
backdated, and nothing is restated.

`INVOICE_VAT_RATE=0` prints the franchise mention
(*TVA non applicable, art. 293 B du CGI*) rather than silence: a French document
must do one or the other, and saying nothing lets a professional client read a
deductible VAT that does not exist.

### 4.2 It never claims a payment that did not happen

`MOCK_PAYMENTS` writes `captured` rows with a synthetic `pi_mock_` intent and no
money behind them, and that is the lane user testing runs on. The row is still
written and the document is still raised — the flow has to be demonstrable — but
`isPaid` on the PDF is **not** `status === 'paid'`. It is

```
source === 'stripe' && !isMockIntent(stripePaymentIntentId)
```

the same guard `refundForJob` already applies. A synthetic charge prints
*« Paiement simulé (environnement de test) — aucun montant n'a été débité. »*
where the PAYÉ stamp would be.

This cannot reach a real client: `MOCK_PAYMENTS` throws at boot in production
(`env-assertions.ts`), and every non-production email is redirected to
`EMAIL_DEV_RECIPIENT` or dropped (`lib/email.ts`).

### 4.3 It is frozen at issue

The PDF used to be rendered from live joins, so editing your account name
rewrote a document already in someone's inbox. The billed party and the
prestation are snapshotted onto the row at issue: `billing_name`,
`billing_email`, `billing_address` (the user's default address when there is
one), `line_description`. The emailed PDF and every later download are the same
document.

Older rows have none of these; the mapper falls back to the live join exactly as
before, so nothing regresses and nothing is backfilled.

### 4.4 It is French

The whole document was English — *INVOICE*, *Bill To*, *Thank you for your
business!* — with `fr-FR` dates, reached from a screen called *Mes factures*.
It is now French throughout, like `EarningsStatementPDF` and
`ConfirmationRequestEmail`, for the same stated reason: the recipients are
French clients.

## 5. Correction — the avoir

An invoice that exists before delivery is exposed to five paths that give the
money back or undo the award:

| Path | Payment becomes | Document response |
|---|---|---|
| `shipmentService.cancelShipment` | `refunded` | credit note |
| any operator un-award that refunds | `refunded` | credit note |
| `refundService.processRefund` (`POST /api/admin/refunds`) | `refunded` | credit note |
| `compensateFailedAward` | unchanged (charge failed) | none — no invoice exists |
| `deleteUserAccount` | row deleted (cascade) | none — the party is gone |

An issued, numbered, emailed document is corrected by a **facture d'avoir**, not
by mutation and not by `void`: `void` is defensible only for a draft that never
left the building, a state this codebase does not produce. The `void` enum member
stays, reserved and commented, because removing it is a migration that buys
nothing.

A credit note is an `invoices` row with `kind = 'credit_note'`, a **negative**
`amount`, `related_invoice_id` pointing at what it corrects, and its own
`AV-<year>-NNNN` series so the invoice series keeps no gaps.

It is minted from exactly one place — `paymentsService.markRefunded`, the only
transition into `refunded` — so the two refund writers cannot drift. It is
idempotent on `related_invoice_id`, in the service *and* in the database: a
partial unique index mirrors the one on the invoice side, because a losing writer
would otherwise take a fresh number from the sequence rather than collide, and
two avoirs would stand against one facture.

`markRefunded` contains its own paperwork failure, like the issue does, so a
credit note that fails to write leaves the refund standing. `refundForJob`'s
early return on an already-refunded payment retries it — the backstop the
invoice side has in `settleDelivery`.

**It names what it corrects.** `related_invoice_number` is frozen onto the row
beside the id, so the document prints *Avoir sur INV-2026-0001* on its own face
rather than a negative amount with no referent.

**Revoke then re-award is correct by construction.** `commitAward` mints a fresh
shipment each time, so a re-award writes a second captured payment and a second
invoice. The ledger then reads facture 1 → avoir 1 → facture 2, which is what
happened.

## 6. Numbering

`generateInvoiceNumber` counted rows matching `INV-<year>-%` and added one, in a
statement separate from the insert, against a UNIQUE column. Two awards in the
same second computed the same string and the loser got a 23505. Worse, deletion
is reachable — `invoices.payment_id` and `invoices.user_id` both cascade, and
`docs/TESTING_MOCKS.md` §1 instructs purging `pi_mock_` payment rows before real
charging goes live — and after any non-highest row is deleted, `count + 1`
re-derives a number already used, forever. A retry loop over that never
terminates.

`document_sequences (series, year, last_value)` replaces it. Allocation is

```sql
INSERT INTO document_sequences (series, year, last_value) VALUES ($1, $2, 1)
ON CONFLICT (series, year) DO UPDATE SET last_value = document_sequences.last_value + 1
RETURNING last_value
```

inside the same transaction as the insert, so the number and the row commit
together or not at all. The migration backfills each series' high-water mark from
`MAX(sequence)` of the existing numbers — not from `count(*)` — so a number that
was issued and later deleted is never handed out twice.

A partial unique index enforces the idempotency the service already assumed:

```sql
CREATE UNIQUE INDEX invoice_payment_unique ON invoices (payment_id) WHERE kind = 'invoice';
```

Partial, because a credit note references the same payment as the invoice it
corrects.

## 7. Email

### 7.1 Automatic, at issue

`InvoiceDocumentEmail` — French, the house React Email shape — with the rendered
PDF attached as `<number>.pdf`, matching the download's `Content-Disposition`.
Sent unless `preferences.notifications.email.invoiceReady === false`, in its own
`try`: a Resend outage must not fail a payment.

`@react-pdf/renderer` is loaded with a dynamic `import()` inside the send. A
static import would put the PDF renderer into the import graph of every route
that reaches `api-response.ts` — 59 of them — via
`api-response → shipment.service → invoices.service`.

`SendEmailSchema` gains `attachments`; `sendEmail` forwards it with the same
conditional spread already used for `replyTo`. Content is base64 — the Resend SDK
JSON-encodes the body, so a `Buffer` would go over the wire as
`{"type":"Buffer","data":[…]}`.

### 7.2 On demand

`POST /api/user/invoices/[id]/email` re-sends **to the invoice owner's own
account address**. It takes no recipient: an endpoint that mails a PDF to an
address supplied by the caller is an open relay with the platform's domain on it.

Rate limited to 5 per hour per (user, invoice). An impersonating admin may use
it: it is a deliberate click, and the mail goes to the account holder, not to the
admin — `impersonation-guard.ts` reserves its refusal for writes that fire from a
page load.

## 8. API

### `POST /api/user/invoices/[id]/email`

Body: none. Response: `{ sentTo: "c***@example.com" }` — masked, so the response
confirms delivery without restating an address to whoever holds the session.

| Scenario | Code | Status |
|---|---|---|
| Not signed in | `UNAUTHENTICATED` | 401 |
| Unknown id | `INVOICE_NOT_FOUND` | 404 |
| Someone else's invoice | `INVOICE_NOT_YOURS` | 403 |
| More than 5 sends in an hour | `RATE_LIMITED` | 429 |
| Resend refused | `INVOICE_EMAIL_FAILED` | 502 |

### `GET /api/user/invoices/[id]/pdf`

Unchanged contract; it now reaches the row through
`invoicesService.getOwnedInvoice` instead of calling the DAL directly and
inlining the ownership check, and answers the standard envelope so the two
buttons in one row fail the same way.

`invoicesService` stops throwing bare `Error`. `getById`'s
`new Error("Unauthorized access to invoice")` reached `handleError` as an
untranslatable 500; it is now `InvoiceError("INVOICE_NOT_YOURS", 403)`, already
in the `instanceof` chain.

## 9. Screen

`/profile/invoices` gains an **Envoyer par e-mail** action beside the existing
download, through a `useMutation` on the shared `api.post` client so the toast
can key off `ApiError.code`. The failure branch moves from `error ?` and an
ad-hoc div to `isError` and `CenteredEmptyState` with a retry (CLAUDE.md gotcha
9). A credit-note row is labelled and shows its negative amount.

Light and dark need no new colour: the status badges already carry `dark:`
variants and the button uses the existing tokens.

## 10. The contract this contradicts

`marketing.terms` §Paiement still reads *« Les fonds sont autorisés et bloqués
lors de l'attribution de la course. Ils sont débités une fois la livraison
confirmée, jamais avant. »*

That stopped being true when `payment_at_booking_spec.md` shipped. While nobody
diffed the page against the ledger it was a stale marketing sentence; the moment
the platform mails each client a receipt for a debit taken at attribution, it is
the platform's own evidence that its published terms were not honoured. Both
paragraphs are corrected in FR and EN in this change.

## 11. Edge cases

1. **Charge fails.** No captured row, so no document. `compensateFailedAward`
   returns the job to the board as before.
2. **Re-award after a revoke.** Facture, avoir, facture. §5.
3. **Delivery of a job invoiced at booking.** `settleDelivery` still calls
   `createFromPayment`; `getByPaymentId` short-circuits. The call is kept as the
   backstop for payments captured before this shipped.
4. **Legacy delivered rows.** Already invoiced at delivery. Nothing is
   backfilled, nothing is re-issued.
5. **Escalated job.** No Expeditoo document, at booking or at delivery. §3.
6. **Client with no default address.** The billing block prints name and email
   only. A facture needs the address; a reçu does not, which is another reason
   §4.1 refuses the title until the surrounding identity exists.
7. **Empty period bundle.** Unchanged: a one-page document saying there was no
   activity.
8. **Webhook arrives for an already-captured row.** `markCaptured` refuses the
   transition and returns the row; no second document.
9. **Webhook arrives after a refund.** Refused. Previously it resurrected the
   row.
10. **Invoice email preference off.** The row is still written and downloadable;
    only the automatic mail is skipped. The on-demand route ignores the
    preference — asking for it *is* the consent.
11. **A refund Stripe reports as `pending`.** `refundService.processRefund`
    treats `pending` as terminal — it did so before this change — so the row
    moves to `refunded` and the avoir is raised and emailed for money that has
    not necessarily landed. Nothing listens for `charge.refund.updated`, so a
    refund that later fails leaves the correction standing. **Known limit**, not
    fixed here: it is a gap in refund confirmation rather than in invoicing, and
    the honest fix is a webhook case, not a change to what a refund means.
12. **Dates are rendered in `Europe/Paris`**, explicitly. The server runs in UTC,
    so a payment taken at 23:30 in Paris printed the previous day on the client's
    own receipt. `photo-stamp.service.ts` pins the same zone for the same reason.

## 12. Test coverage required

- [ ] A captured `source='stripe'` payment raises exactly one invoice
- [ ] A second capture attempt on the same payment raises none
- [ ] A `source='expedion'` payment raises none, at booking or at delivery
- [ ] A failed charge raises none
- [ ] An invoice write that throws does not fail the award or the charge
- [ ] The webhook routes through `captureByIntent` rather than writing the row
- [ ] `captureByIntent` sets `capturedAt` and raises a document
- [ ] `captureByIntent` refuses `refunded → captured` and `captured → captured`
- [ ] An issue that throws does not escape `afterCapture` into the award
- [ ] Each refund writer mints exactly one credit note, with a negative amount
      and a `related_invoice_id`
- [ ] A second refund of the same payment mints no second credit note
- [ ] A refund of a payment with no invoice mints nothing and does not throw
- [ ] Numbers are allocated from the sequence, per series and per year
- [ ] Two concurrent issues take different numbers
- [ ] The document is titled *Facture* with a complete issuer and *Reçu de
      paiement* without one
- [ ] A `pi_mock_` charge never renders the paid stamp
- [ ] `VAT_RATE=0` prints the franchise mention; a rate prints HT / TVA / TTC
- [ ] The email carries the PDF as a base64 attachment named after the document
- [ ] `POST .../email` answers 403 for a foreign invoice and 429 over the limit
- [ ] `GET .../pdf` answers the standard envelope on refusal
- [ ] FR/EN key parity holds
