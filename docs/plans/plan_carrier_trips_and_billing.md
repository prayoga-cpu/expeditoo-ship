# Plan — Carrier trips and billing documents

**Status:** Implementing
**Roadmap ref:** `ROADMAP.md` §8 Phase D (route publishing and matching), §10 (commission — still open)
**Specs:** `docs/specs/carrier_trips_spec.md`, `docs/specs/billing_documents_spec.md`
**Date:** 2026-08-26

---

## 1. What the client asked for

Two messages, 1.33pm and 1.34pm:

> Two additional sections for the carrier in Expeditoo: My trips; journeys
> carried out regularly or occasionally (on specific dates). My journeys (these
> are transports actually carried out)
>
> Can be mixed in one screen

Plus a Cocolis screenshot of *Mes paiements* — the screen where a customer
downloads their shipping invoices — as the visual reference: a search box, a
period filter, a transaction-type filter, a **Télécharger toutes les factures de
la période** button, and per-row cards carrying a status pill, title, reference
number, amount, and the two route endpoints as pins.

So there are three things, not two: declared supply, execution history, and the
money documents that hang off the history.

## 2. Audit — what exists before this change

### 2.1 "My journeys" is already built, twice

| Surface | Route | Audience |
|---|---|---|
| `Deliveries` | `/deliveries` | any party to the shipment, tabs active/past |
| `MyShipments` | `/driver/shipments` | `driver` role only |

Both read `GET /api/shipments`, which returns "every shipment the caller is a
party to, in any capacity" and redacts commercial terms for drivers
(`redactForDriver`). `shipments` already carries route, price, scheduled and
actual timestamps, status and proof of delivery — every field a "carried out"
row needs.

**Decision:** do not build a third list. The Effectués tab reuses
`GET /api/shipments`, restyled to the Cocolis card, and gains the money column
that neither existing list shows.

### 2.2 "My trips" does not exist in any form

`grep -riE "trajet|recurring|recurrence|availability|planned"` across `src/`
returns nothing but marketing copy and an unrelated backfill script. There is no
table, no column, no route.

`ROADMAP.md` §8 Phase D names this exactly — *"Route publishing and matching"* —
so this ask pulls Phase D forward.

The marketing page already sells it as though it shipped
([fr.json](../../messages/fr.json) `marketing.carriers.advantages.item1.desc`):
*"Filtrez les courses sur vos trajets existants. Un retour Bordeaux–Paris cesse
d'être des kilomètres à vide."* That sentence becomes true with this change.

### 2.3 Matching needs no new engine

`browseListingsQuerySchema`
([listings.dto.ts](../../src/server/dto/listings.dto.ts)) already accepts
`nearLat`, `nearLng`, `radiusKm`, `pickupFrom`, `pickupUntil`, `maxWeightKg` and
`sort=distance_asc`, and the board threads all of them. A saved trip is
therefore a **saved query**, not a new subsystem: the card's "see matching jobs"
button deep-links `/expedion` with the trip's parameters.

### 2.4 Invoicing is wired but dead

| Piece | State |
|---|---|
| `invoices` table, `invoices.dal`, `invoices.service` | exist |
| `GET /api/user/invoices`, `/[id]`, `/[id]/pdf` | exist, PDF renders via `@react-pdf/renderer` |
| `/profile/invoices` + `InvoiceList` | exist |
| `invoicesService.createFromPayment` | **called from nowhere in production** — only from its own test file |
| Link to `/profile/invoices` from any nav | **none** — the only href is inside an email body |

So the invoice list is permanently empty and unreachable. The PDF line item is
hard-coded to `"Marketplace Purchase"`, a leftover from the goods marketplace.

### 2.5 The carrier's money is not the customer's invoice

`invoices.userId` ← `payments.userId` ← `listing.shipperId`. For an
Expedion-origin job that is the **system account**, so no human would ever hold
an invoice for an escalated delivery. The carrier's document is the opposite
direction: a statement of what they earned.

And what they earned is currently **zero**. `COMMISSION_RATE = 1.0`
([payments.service.ts](../../src/server/services/payments.service.ts)) — the
platform keeps 100% during the testing phase, decided by the client on
2026-08-26 — so `payouts.amountCents = amountCents - commissionCents = 0`.

**Decision:** the earnings surface reports the real ledger — gross, commission,
net — and today's net reads €0.00. It does not invent a split. When
`ROADMAP.md` §10 names the real rate, the same screen starts telling a different
and equally true story with no code change.

## 3. What gets built

One screen, `/carrier/trips`, two tabs, as the client asked.

```
/carrier/trips
├── Planifiés   — declared routes (recurring / occasional)   ← net new
└── Effectués   — transports carried out + money + documents ← reuses /api/shipments
```

Plus the customer half of the Cocolis reference at `/profile/invoices`, made
reachable and actually populated.

### Stage 1 — Schema

`src/db/schema/carrier-routes.ts`:

- `carrier_routes` — carrier, label, kind (`recurring` | `occasional`), origin
  and destination (address/city/postal/lat/lng), `radius_km`, `days_of_week`
  (recurring), `valid_from` / `valid_until`, optional `vehicle_id`,
  `capacity_kg`, `notify_on_match`, `is_active`.
- `carrier_route_dates` — one row per specific date for an occasional trip,
  unique on `(route_id, date)`.

Two tables rather than a JSON column because "on specific dates" is
multi-valued and gets queried by date range when matching.

Migration via `pnpm db:generate`.

### Stage 2 — Server, trips

DTO → DAL → service → routes, per `docs/rules.md`.

- `carrier-routes.dto.ts` — create/update/query schemas, with the recurring vs
  occasional discrimination enforced in Zod, not in the UI.
- `carrier-routes.dal.ts` — permission-blind CRUD, dates written in the same
  transaction as their parent route.
- `carrier-routes.service.ts` — every method gated by `requireOwnCarrier`;
  throws `CarrierRouteError` with a code and status, registered in
  `api-response.ts`.
- `GET|POST /api/carrier/routes`, `GET|PATCH|DELETE /api/carrier/routes/[id]`.

### Stage 3 — Server, money

- `earnings.dal.ts` / `earnings.service.ts` — the carrier's completed
  deliveries joined to `payments` and `payouts`, returning gross, commission and
  net per row plus a period summary.
- `GET /api/carrier/earnings` — list + summary, filterable by period.
- `GET /api/carrier/earnings/statement` — one PDF covering a period, the
  carrier-side answer to Cocolis's "download all invoices for the period".
- `EarningsStatementPDF.tsx`.

### Stage 4 — Invoicing, brought back to life

- Call `invoicesService.createFromPayment` from `settleDelivery` in
  `shipment.service.ts`, immediately after capture. Idempotent already
  (`getByPaymentId` short-circuit), so a re-delivered shipment cannot mint two.
- Extend `invoiceQuerySchema` and `invoicesDal.getByUserId` with `from` / `to`.
- `GET /api/user/invoices/statement` — the same period PDF, customer side.
- Fix the PDF line item to name the actual job instead of
  `"Marketplace Purchase"`.
- Link `/profile/invoices` from the profile screen so it stops being orphaned.

### Stage 5 — UI

- `CarrierTripsScreen` — tabs, and the Cocolis controls (search, period,
  type, download-period) on the Effectués tab.
- `TripRouteCard`, `TripRouteFormDialog` (reusing `LocationPickerField`, which
  already does Nominatim search, a draggable pin, reverse geocoding and a France
  bound), `CompletedTripCard`.
- Sidebar and bottom-nav entries.
- FR + EN keys, parity exact.

### Stage 6 — Gates

`npx tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`. New unit tests for
the trips service (ownership, kind validation, cap) and the earnings service
(summary arithmetic, redaction).

## 4. What this deliberately does not do

- **No operator-visible supply pool.** A trip is private to the carrier: it
  filters the board and (later) raises an alert. Making routes something an
  operator awards against would touch `offersService.acceptOffer`,
  `/admin/awards` and the Expedion fork, and would raise whether a declared
  route implies a price commitment. Out of scope, chosen deliberately.
- **No match notifications yet.** `notify_on_match` is stored and honoured by
  nothing in this pass. The cron that reads it is a follow-up; the column exists
  now so the follow-up is not a migration.
- **No invented commission.** See §2.5.
- **No third shipment list.** See §2.1.
