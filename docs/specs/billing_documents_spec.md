# Specification: Billing documents (carrier earnings + customer invoices)

**Plan:** `docs/plans/plan_carrier_trips_and_billing.md`
**Related:** `docs/specs/carrier_trips_spec.md`
**Supersedes for this surface:** `billing_invoicing_spec.md` and
`earnings_payouts_spec.md`, both of which describe the v1 goods marketplace
(sellers, items, orders) and cannot be built from.
**Date:** 2026-08-26

---

## 1. Overview

The Cocolis *Mes paiements* reference is two screens in this product, because
the payer and the earner are different people and, for an escalated job, the
payer is not a person at all.

| Surface | Audience | Reads | Document |
|---|---|---|---|
| `/carrier/trips` → Effectués | the carrier who drove | `payouts` + `payments` + `shipments` | period **relevé** |
| `/profile/invoices` | whoever paid for a direct request | `invoices` | per-invoice PDF + period statement |

## 2. The honesty constraint

**Stale:** `COMMISSION_RATE` is `0.1`, not `1.0` — the split was decided and the
driver's 90% accrues as a withdrawable balance. The reasoning below stands for
any rate; only the figure moved.

`COMMISSION_RATE = 1.0` in
[payments.service.ts](../../src/server/services/payments.service.ts): the
platform keeps 100% during the testing phase, decided by the client on
2026-08-26. Therefore `payouts.amountCents = amountCents − commissionCents = 0`
for every row written today.

**The earnings surface reports what the ledger says.** Gross, commission and net
are three separate figures, all three shown, and net currently reads €0.00. No
code invents a split. When `ROADMAP.md` §10 names a real rate, the same screen
reports the new truth with no change here.

The screen carries a one-line note while `COMMISSION_RATE >= 1` explaining that
no payout is due under the current arrangement, so a carrier reading €0.00 is
not left to guess whether it is a bug.

## 3. Carrier earnings

### 3.1 Source

One row per **delivered** shipment where `shipments.carrier_id` is the caller,
joined to `payments` (on `shipment_id`) and `payouts` (on `shipment_id`).

| Field | Source | Note |
|---|---|---|
| `grossCents` | `payments.amount_cents` | what the job was billed at |
| `commissionCents` | `payments.commission_cents` | platform's cut, held at source |
| `netCents` | `payouts.amount_cents` | what the carrier is owed |
| `payoutStatus` | `payouts.status` | `scheduled` today; nothing advances it |
| `paidAt` | `payouts.paid_at` | null today |
| `capturedAt` | `payments.captured_at` | when the money was actually taken |

A delivered shipment with no `payments` row (possible for legacy rows) reports
zeros and `payoutStatus: null` rather than being dropped — a delivery that
happened is history whether or not money was recorded against it.

### 3.2 `GET /api/carrier/earnings`

Query: `from` (ISO date, optional), `to` (ISO date, optional), `page`, `limit`.

```json
{
  "items": [
    {
      "shipmentId": "…", "listingTitle": "…", "reference": "…",
      "deliveredAt": "2026-08-24T…", "pickupCity": "Châtellerault",
      "dropoffCity": "Montrouge",
      "grossCents": 3000, "commissionCents": 3000, "netCents": 0,
      "payoutStatus": "scheduled", "paidAt": null
    }
  ],
  "summary": {
    "deliveries": 12, "grossCents": 41000,
    "commissionCents": 41000, "netCents": 0,
    "paidCents": 0, "pendingCents": 0
  },
  "total": 12, "page": 1, "limit": 20, "totalPages": 1
}
```

`pendingCents` is the net of payouts not yet `paid`; `paidCents` the net of
those that are. Both are zero today, and both stop being zero the moment the
rate changes — no code change.

Permissions: session required (401), and the caller must have a carrier record —
`requireOwnCarrier`, so `CARRIER_NOT_FOUND` 404 otherwise. A **driver** employee
has no earnings surface: prices are redacted from drivers throughout
(`roles_spec.md` §3) and this route does not make an exception.

### 3.3 `GET /api/carrier/earnings/statement`

Same `from`/`to`. Answers a PDF, `Content-Disposition: attachment`, named
`releve-<from>-<to>.pdf`.

Contents: carrier identity (company name, SIRET), the period, one line per
delivery (date, reference, route, gross, commission, net) and the period totals.

It is titled **Relevé d'activité**, not *Facture*. It is a statement of what the
platform recorded, not a self-billing invoice, because a self-billing invoice
asserting €0 payable is a legal claim this repo is not in a position to make.
`ROADMAP.md` §10 is the blocker; this is noted in the PDF footer.

The route is capped at 500 rows per statement; beyond that it answers
`STATEMENT_TOO_LARGE` 400 and asks for a narrower period, so a PDF render cannot
hold a request open indefinitely.

## 4. Customer invoices

### 4.1 Generation — the missing wire

> **Superseded on 2026-09-05 by `invoice_at_payment_spec.md`.** The wire below is
> now a *backstop*, not the trigger: the document is raised the moment the money
> is taken, which is at booking. Two of this section's conclusions were also
> reversed. An escalated job gets **no document at all** here (that client was
> invoiced by Expedion — this section's own reasoning, followed through), and the
> row is written `paid` rather than `issued`, because the money is already taken.
> The rest of the section still describes the delivery-time call accurately.

`invoicesService.createFromPayment` exists, is tested, and is **called from
nowhere**. It is now called from `settleDelivery` in
[shipment.service.ts](../../src/server/services/shipment.service.ts),
immediately after `schedulePayout`:

```
read the payment → schedule payout → create invoice
```

**There is no capture step here any more.** The client is charged when the
transport is chosen, not on delivery
(`docs/specs/payment_at_booking_spec.md` §5), so `settleDelivery` reads a
payment that is already `captured` rather than capturing one. A payment in any
other state means the money never arrived: the payout and the invoice are both
skipped and the delivery still stands.

Behaviour:

- Idempotent already — `getByPaymentId` short-circuits, so the two delivery
  paths (`updateStatus` → DELIVERED and `uploadProofOfDelivery`) cannot mint two
  invoices for one shipment.
- **Never throws into the delivery path.** A failing invoice write must not
  leave a delivered shipment un-settled, so the call is wrapped and logged. The
  delivery is the fact; the paperwork can be regenerated.
- Runs under `MOCK_PAYMENTS` too: a mock capture still produces a real
  `payments` row, so it still produces a real invoice.

**Whose invoice.** `invoices.userId` = `payments.userId` = `listing.shipperId`.
For a `direct` job that is the person who posted it. For an `expedion` job that
is the system account, and no human sees it — correct, because the Expedion
client was invoiced by Expedion, not here.

### 4.2 Period filtering

`invoiceQuerySchema` and `invoicesDal.getByUserId` gain `from` / `to`, applied
to `issued_at` and falling back to `created_at`. Existing `status`, `page`,
`limit` unchanged.

### 4.3 `GET /api/user/invoices/statement`

`from` / `to`. One PDF containing every invoice in the period, one page each,
named `factures-<from>-<to>.pdf`. This is the Cocolis
*Télécharger toutes les factures de la période* button.

Same 500-row cap and `STATEMENT_TOO_LARGE` 400.

### 4.4 PDF line item

The existing PDF hard-codes `"Marketplace Purchase"`. It now names the job:
the linked payment's listing title, falling back to `"Transport"` when the
listing is gone. No other change to `InvoicePDF`.

### 4.5 Reachability

`/profile/invoices` is linked from no navigation. A link is added to the profile
screen so the surface is reachable without knowing the URL.

## 5. Error scenarios

| Scenario | Code | Status |
|---|---|---|
| Not signed in, any route here | `UNAUTHENTICATED` | 401 |
| Earnings, caller has no carrier record | `CARRIER_NOT_FOUND` | 404 |
| `from` after `to` | `VALIDATION_ERROR` | 400 |
| Statement covering > 500 rows | `STATEMENT_TOO_LARGE` | 400 |
| Invoice PDF for someone else's invoice | `FORBIDDEN` | 403 |

## 6. Edge cases

1. **Delivered before this change shipped.** No invoice exists and none is
   backfilled. The earnings row still appears, sourced from `payments`.
2. **Cancelled shipment.** ~~Payment is `released`, never captured, so no invoice
   and no payout.~~ **Stale since `payment_at_booking_spec.md`**: the client is
   charged at award, so a cancelled shipment *has* a captured payment, which is
   refunded rather than released. Since `invoice_at_payment_spec.md` it also has
   a document, corrected by a credit note when the refund is made. It still
   appears in the Effectués list with a `CANCELLED` pill and no money figures.
3. **Delivery with `MOCK_PAYMENTS` on.** Real `payments` row, real payout row,
   real invoice. The synthetic intent id is the only difference.
4. **Empty period.** The statement route answers a valid PDF containing the
   period header and a "no activity" line, not a 404 — an empty statement is a
   meaningful accounting artefact.
5. **Commission rate changes mid-history.** `payments` records no rate per row,
   so old rows are indistinguishable from new ones except by date. Already
   recorded as a known gap in `payments.service.ts`; this spec does not fix it.

## 7. Test coverage required

The invoicing half of this list is superseded by
`invoice_at_payment_spec.md` §12, which covers issuance at capture, the escalated
lane, the credit note and the numbering. The earnings half below still stands.

- [ ] `settleDelivery` creates exactly one invoice per shipment
- [ ] A second delivery transition does not mint a second invoice
- [ ] An invoice write that throws does not fail the delivery transition
- [ ] Earnings summary sums gross, commission and net across rows
- [ ] Earnings reports a delivered shipment with no payment row as zeros
- [ ] Earnings excludes shipments the caller did not carry
- [ ] A caller with no carrier record gets `CARRIER_NOT_FOUND`
- [ ] `from` after `to` is rejected on both statement routes
- [ ] Invoice period filter bounds on `issued_at`
- [ ] Statement over the row cap answers `STATEMENT_TOO_LARGE`
