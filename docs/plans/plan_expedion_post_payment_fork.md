# Plan — Expedion post-payment fork (paid → assign or publish)

**Status:** Implemented — Stages 0–4 and 6. Stage 5 (driver pay) still blocked.
**Roadmap ref:** `ROADMAP.md` §5, §9 (Expedion bridge), §10 (commission — still open)
**Extends:** `plan_expedion_operator_self_service.md`, `plan_phase_a_bidding_core.md`
**Spec:** `docs/specs/expedion_post_payment_fork_spec.md`
**Date:** 2026-08-22

---

## 1. What this fixes

Once an Expedion client pays, three things should be true and none of them are:

1. The price is settled — nobody may edit it in place.
2. The quote states that it is waiting on an operator, not on the client.
3. The operator gets a real choice: hand the job to a driver in the pool, or
   put it out to bid on Expeditoo. Both are one click, neither is buried.

Today payment lands and the row goes straight to the escalation timer's
verdict, the price stays editable through two separate surfaces, and the
"assign a driver" branch writes three columns and stops.

## 2. Audit — what is actually wrong

### 2.1 The "needs a driver" window barely exists

`markPaid` stamps `escalateAfter = now + escalationWindowHours()`
([expedion.service.ts](../../src/server/services/expedion.service.ts)), and
`nextAction` ranks `escalationDue` **above** `needsDriver`
([quote-action.ts](../../src/features/app/admin/expedion/lib/quote-action.ts)).
So a paid quote reads "Needs a driver" only until the deadline passes.

`.env.local` sets `EXPEDION_ESCALATE_AFTER_HOURS=0.01` — 36 seconds. In dev the
decision window is gone before an operator can see it, and every paid quote
sits at "Escalation blocked" instead.

### 2.2 `escalateAfter` is written in the wrong time zone

Observed on quote `178v2gngfP_Q_MQk-1D2V`:

| | value |
|---|---|
| event metadata `escalateAfter` | `2026-08-22T06:13:27.858Z` (= 14:13 local, correct) |
| stored `expedion_quotes.escalate_after` | `2026-08-22 06:13:27.858` |
| `now()::timestamp` at the same moment | `2026-08-22 14:26:42` |

The deadline columns are `timestamp` **without** time zone. Dates written from
JS land as UTC wall-clock; `defaultNow()` and `now()` are session-local (+08
here). Every deadline predicate — `ESCALATION_DUE`, `storageAtRisk`,
`findDueForEscalation`, the Waiting column — compares across both families, so
locally a quote is escalation-due eight hours before it should be.

Production runs on Vercel with `TZ=UTC`, where the two agree; this is a dev and
non-UTC-deployment defect, not a live one. It still has to go, because it makes
the whole fork untestable.

### 2.3 The price is editable after payment, through three doors

| Door | Guard today |
|---|---|
| Row ⋮ → "Adjust price" → `RepriceDialog` | none — rendered on every row at every status; only the *status* advance is gated |
| `QuoteDetailDialog` edit mode → `acceptedPriceCents` | none — free-text at any status |
| `PATCH /api/expedion/quotes/:id/admin` | `adminUpdate` validates status transitions only |

`acceptedPriceCents` is what Stripe charged and what becomes the marketplace
`budgetCents` on escalation. Editing it after settlement desynchronises the
recorded amount from the captured one and moves the bid ceiling off the money
that actually exists.

### 2.4 Payment produces one button, not a fork

`needsDriver` → a single "Assign" button. "Publish to Expeditoo" is in the ⋮
overflow, alongside actions that are illegal for the row's state (the menu is
identical on a delivered row and a cancelled one).

### 2.5 The assign lane never reaches the driver

`adminUpdate` with `assignedCarrierId` writes `assignedCarrierId`,
`assignedAt`, `status='assigned'`, texts **the client**, and returns. It does
not create a `shipments` row, so:

- the driver app shows nothing — `/home`, the shipment list and `JobBoard` are
  all listing/shipment-driven
- there is no payment hold and no payout record
- nothing can move the quote to `picked_up` / `delivered` except an admin
  hand-editing status in the detail dialog
- `expedionSmsService.driverAssigned` sends to `updated.phone` — the client's
  number. The driver is never told.

`expedion-bridge.service.ts` keys every write-back on `listingId`, so a quote
that was assigned but never escalated has no return leg by construction.

The picker also lists only `approved` carriers
([api/admin/carriers/route.ts](../../src/app/api/admin/carriers/route.ts)); dev
has one carrier in `draft`, so it renders empty.

### 2.6 The escalation lane's write-back cannot succeed

Found while specifying Stage 3. Two id spaces are being crossed:

| Column | References |
|---|---|
| `expedion_quotes.assigned_carrier_id` | `carriers.id` |
| `offers.carrier_id` | `user.id` |
| `shipments.carrier_id` | `user.id` |

`expedionBridgeService.writeBack` assigns `input.carrierId` straight into
`assignedCarrierId`, and its only caller `onOfferAccepted` passes
`offer.carrierId` — a **user id** — into a column whose FK points at
`carriers.id`. Awarding an escalated job therefore raises a foreign-key
violation inside the write-back, which `notifyExpedion` swallows by design
(`void work.catch(...)`).

The award succeeds; the Expedion client is never told which carrier won, and
the quote sits at `escalated` permanently. This is Phase D's exit criterion,
silently broken. No dev row has ever been escalated *and* awarded, which is why
nobody has hit it — `select … where listing_id is not null` returns nothing.

Fixed in Stage 3, because `assignDirect` runs through the same write-back and
would inherit it.

### 2.7 Neither lane defines what the driver is paid

Escalation sets `budgetCents = acceptedPriceCents` — the whole client payment
as the bid ceiling. Direct assignment sets no price at all. `ROADMAP.md` §10 is
still open. Out of scope here; named so it is not mistaken for done.

## 3. Decisions taken

**Assignment is escalation with a pre-selected winner.** Assigning a driver
escalates the quote through the existing mapper, then immediately accepts a
synthetic offer from the chosen carrier at the accepted price. This reuses
`offersService.acceptOffer` whole — payment hold, shipment creation, and
write-back all come for free, and there is exactly one execution path to keep
correct. The cost is a `listings` row for a job that was never really on the
market — it is `open` only for the duration of the one service call that then
awards it, and `browse` returns only `open` rows, so no flag or migration is
needed to keep it off `/expedion`. Spec §4.2 records why that window is
accepted rather than engineered around.

**A paid price is immutable, with a cancel-and-re-quote path.** All four price
fields lock at payment. A wrong price is corrected by unwinding the quote and
returning it to `quoted` so the client accepts and pays the corrected figure —
the recorded amount and Stripe never disagree. The refund itself happens on the
Expedion side, which is where the money is; see Stage 4.

## 4. Stages

### Stage 0 — make the window observable
- `EXPEDION_ESCALATE_AFTER_HOURS` in `.env.local` raised to a workable value.
- Deadline columns (`escalate_after`, `assigned_at`, `escalated_at`,
  `storage_free_until`, `sale_date`) move to `timestamp with time zone`, so a
  JS `Date` and `now()` name the same instant. One migration.
- Files: `.env.local`, `.env.example`, `src/db/schema/expedion.ts`, new
  migration.

### Stage 1 — lock the price at payment
- `adminUpdate` refuses `quoteStandardCents`, `quoteInsuredCents`,
  `quoteAvailable`, `acceptedPriceCents` once `paymentStatus === 'paid'` —
  typed `PRICE_LOCKED` / 409. Server first; the UI is not the guard.
- New `quoteCapabilities(quote)` beside `nextAction`, exposing `canReprice`,
  `canAssign`, `canEscalate`, `canEditStorage`. The ⋮ menu and the detail
  dialog both read it, so a hidden button and a refused request cannot
  disagree.
- `QuoteDetailDialog` renders `acceptedPriceCents` read-only when locked, with
  the reason.
- Files: `expedion.service.ts`, `quote-action.ts`, `RecentQuotesPanel.tsx`,
  `QuoteDetailDialog.tsx`, `messages/{en,fr}.json`.

### Stage 2 — the fork on the row
- `needsDriver` rows get two co-equal buttons: **Assign a driver** and
  **Publish to Expeditoo**.
- The Waiting column carries the deadline ("auto-publishes in 47 h"), so the
  timer reads as the fallback it is rather than the decision-maker.
- `escalationDue` still outranks `needsDriver` — it is the out-of-time state.
- ⋮ pruned to what `quoteCapabilities` allows for that row.
- Files: `RecentQuotesPanel.tsx`, `quote-action.ts`, `messages/{en,fr}.json`.

### Stage 3 — assignment reaches the driver
- New `expedionEscalationService.assignDirect(quoteId, carrierId, actor)`:
  escalate through the existing path, insert an offer from that carrier at
  `acceptedPriceCents`, and run it through `offersService.acceptOffer` as the
  operator.
- **No new listing flag and no migration.** `browse` already returns only
  `status = 'open'`, and `commitAward` moves the listing to `awarded` inside
  the same service call — so a directly-awarded job is on `/expedion` for the
  duration of one request, under a row lock. Spec §4.2 records why that is
  accepted rather than engineered around.
- The `carriers.id` ↔ `user.id` crossing in §2.6 is fixed here: `writeBack`
  resolves a user id through `carriersDal.getByUserId` before writing
  `assignedCarrierId`.
- `AssignDriverDialog` posts to the new endpoint instead of PATCHing
  `assignedCarrierId`, and resolves the carrier's vehicle (the offer's
  `vehicleId` is `NOT NULL`).
- The `assignedCarrierId` side-effect in `adminUpdate` is removed — one way in,
  not two.
- Driver notification fixed: the driver is told, not only the client.
- Files: `expedion-escalation.service.ts`, `expedion-bridge.service.ts`,
  `expedion.service.ts`, `expedion.dto.ts`, `AssignDriverDialog.tsx`, new
  `POST /api/expedion/quotes/:id/assign`.

### Stage 4 — cancel and re-quote
- `expedionService.cancelAndRequote(id, actorId)` — clear `acceptedKind` /
  `acceptedPriceCents` / `escalateAfter`, set `paymentStatus` back to `unpaid`
  and status to `quoted`, event on the timeline.
- **It cannot issue the refund.** `refundService` operates on `payments` rows —
  Expeditoo's own holds against shipments — and a quote that never reached a
  shipment has none. EXPEDITOO never took the client's money in the first
  place. So this unwinds our record and surfaces the Stripe Checkout reference
  (recovered from the `markPaid` event) for the Expedion side to refund
  against; the response carries `refundIssued: false` so nothing reads it as
  done. Wiring the actual refund is a payment-server change in
  `expedion_encheres/api/`, outside this repo.
- Refused once a listing or a driver exists; that is a cancellation, not a
  re-quote.
- Files: `expedion.service.ts`, new route, `RequoteDialog.tsx`,
  `RecentQuotesPanel.tsx`.

### Stage 5 — driver pay
Blocked on `ROADMAP.md` §10. Not built here.

### Stage 6 — spec and tests
- `quote-action.test.ts`: the fork, the capability matrix, the deadline label.
- `expedion.service` tests: `PRICE_LOCKED` on each of the four fields, and the
  re-quote path.
- `expedion-escalation.service` tests: `assignDirect` produces exactly one
  listing, one shipment and one payment hold, and is idempotent.
- `expedion-bridge.service` tests: a user id resolves to the matching
  `carriers.id`, and one with no carrier row writes `null` without throwing
  (§2.6).
- E2E: paid → assign → the driver sees the run → delivered → the quote reads
  `delivered`.

## 5. Order and dependencies

```
Stage 0 ──▶ Stage 1 ──▶ Stage 2
   │                       │
   └──────────────────────▶ Stage 3 ──▶ Stage 4
                                │
                                └──▶ Stage 6
```

Stage 0 first: without a truthful deadline, Stages 1–3 cannot be observed
locally. Stage 2 depends on Stage 1's `quoteCapabilities`. Stage 4 depends on
Stage 3 only for the "a shipment exists, refuse" branch.

## 5a. Found by the pre-push review

An adversarial pass over the finished diff (seven dimension finders, two
skeptics per finding on different lenses) raised 23 candidates; eight survived
verification and all eight were real. What they caught, and what it cost:

| Defect | Fix |
|---|---|
| `QUEUE_WHERE.needsDriver` admitted 1085 `picked_up` rows — jobs already in transit — into a queue called "needs a driver" | `status = 'paid'` added, mirroring `ESCALATION_DUE`. Queue drops 1127 → 42 |
| `cancelAndRequote` gated on `paymentStatus` alone, so it would **succeed** on those rows and wipe the price the client paid | `NOT_AWAITING_DISPATCH` 409 unless `status === 'paid'` |
| The price lock stranded 95 live paid quotes carrying no accepted price — unescalatable, and the only repair surface had just gone read-only | Narrow carve-out: supply a missing price, never change a settled one |
| `autoPrice` rewrote a paid quote's prices from `reextractDocument`, straight past `PRICE_LOCKED` | Returns null for a paid quote |
| `assignDirect` published the job *before* checking the actor could award it, so a shared-key caller escalated a quote as a side effect of a 403 | Role check moved ahead of `escalate` |
| The synthetic offer went in via `offersDal.create`, skipping `assertOfferFitsJob` (vehicle capacity), vehicle ownership, and `offers_count` | Routed through `offersService.submitOffer` |
| Every offers-engine and payment failure surfaced as a bare 500 — `expedionErrorResponse` does not translate `OfferError` | Re-labelled with its own code, status and the live listing id |
| A blocked fork row offered "Assign" (a guaranteed 422) beside a "Publish" whose icon and label disagreed with where it went | Collapses to one **Fix** button; badge keyed on `blocked` |
| `QuoteQueueTable` never got the capability filter its sibling table did | Same `quoteCapabilities` gate; a row with nothing allowed shows no menu |
| Direct assignment texted the client "your job is going out to tender", moments before texting them a driver's name | `directAssignment` suppresses the escalation SMS |
| Copy promised a refund the code cannot issue, and the French confirm button read "Annuler…" like the dismiss button beside it | Rewritten; confirm is **Unwind and re-quote** / **Remettre en cotation** |
| Migration 0006 was not replay-safe — applied twice on a non-UTC session it shifts every value again | Each statement guarded on the column still being naive |

A completeness pass then found three the dimension finders had all missed —
including one the fixes above had themselves created:

| Defect | Fix |
|---|---|
| The price-lock carve-out had **no caller**: `QuoteDetailDialog` gated the field and `patchToSend` on `canRepriceQuote`, so the 16 rows the carve-out exists for still could not be repaired | Both gate on `canSupplyMissingPrice`, the client mirror of `isSupplyingMissingPrice` |
| `markPaid` wrote `payment_status = 'paid'` while keeping an illegal status, and `cancelAndRequote` made that reachable — the Expedion success page re-posts `/paid` on every mount, leaving a `quoted` row marked paid that no capability, queue or button could touch | Refuses with `INVALID_TRANSITION` instead of half-writing |
| `canAssign` ignored `escalationReady`, so the overflow put "Assign a driver" back on exactly the rows the blocked-fork collapse protects — all 41 of them | Readiness folded into `canAssign`; `canEscalate` left alone, since its click routes to the fix form |

It also flagged a deploy hazard that is **not** fixed in code: nothing in the
pipeline runs migrations (`build` is a bare `next build`, `vercel.json` is
empty, the only workflow is the cron). The new code reads `assigned_directly`
on every `expedion_quotes` select, so a deploy that precedes `pnpm db:migrate`
fails every read — including the `/paid` endpoint the payment server calls.
0006 and 0007 must be applied to production before or with this deploy.

Refuted on verification, and left alone: claims that the funnel's `assigned`
count needed no marker, that the write-back's SMS branch misfires, that
`requested_at` needed migrating, and several that were reading HEAD rather than
the working tree.

## 5b. Found while building

**`EXPEDION_CATEGORY_ID` was trusted without checking.** `resolveCategoryId`
returned the configured id straight through, so a value naming a category that
does not exist reached `createListing` and died on the foreign key. That is the
state of any environment whose category seed predates the variable — including
this one, where `EXPEDION_CATEGORY_ID=encheres` matched nothing and *both*
lanes of the fork failed with an FK error rather than a usable message. The
configured id is now verified before use, falling through to the existing
`encheres`-slug and first-category fallbacks with a warning.

**Direct assignment broke the escalation-rate KPI.** The funnel splits
`escalated` from `assigned` on `listing_id is null` — and `assignDirect` always
creates a listing, so every pool assignment counted as an escalation and the
rate pinned at 100 %. Fixed with `expedion_quotes.assigned_directly` (migration
0007), which both funnel queries now split on. This is the one place the
"no flag needed" argument in §3 does not hold: `browse` only ever wanted
`status = 'open'`, but the funnel genuinely needs to know how the job found its
driver.

**`carrier_documents.expires_at` has the same time-zone defect as §2.2.**
`admin-nav.dal.ts` compares it against SQL `now()` while it is written from JS,
so the KYC-expiry badge misfires by the server's UTC offset. Same class, same
one-line fix, different feature — left alone rather than widening this change
unasked.

## 6. Out of scope

- The commission split (§2.6).
- Real Stripe hold/capture — this still runs under `MOCK_PAYMENTS`, and Stage 3
  inherits whatever `acceptOffer` does today.
- The `seller`/`buyer` vocabulary still in ~50 cosmetic files.
