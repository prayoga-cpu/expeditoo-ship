# Spec — Expedion post-payment fork

**Plan:** `docs/plans/plan_expedion_post_payment_fork.md`
**Surface:** `/admin/expedion` → Recent quotes, and the quote detail dialog
**Roles:** `admin` and `operator`. A `driver` never reaches any of this.

---

## 1. The lifecycle this pins down

```
quoted ──client accepts──▶ accepted ──payment settles──▶ paid
                                                          │
                            ┌─────────────────────────────┴──────────────┐
                            │                                            │
                  operator assigns a driver                   operator publishes
                            │                                            │
                            ▼                                            ▼
                     listing + shipment                          listing on /expedion
                     (awarded on creation)                       drivers bid
                            │                                            │
                            └──────────────▶ assigned ◀───────────────────┘
                                                │
                                          picked_up → delivered
```

The timer is the third path: at `escalateAfter` the cron sweep publishes the
quote itself. It is a fallback for an operator who did not act, never the
primary route.

## 2. Row state

`nextAction(quote)` keeps its priority order. `paid` maps as:

| Condition | `kind` | Badge | Buttons |
|---|---|---|---|
| `escalateAfter <= now`, no carrier, no listing | `escalate` | Escalation due / Escalation blocked | Publish (or Fix) |
| `queues.needsDriver`, `escalationBlockers` empty | `assign` | **Needs a driver** | **Assign a driver** · **Publish to Expeditoo** |
| `queues.needsDriver`, blockers outstanding | `assign` | Escalation blocked | **Fix** |
| `status = 'accepted'`, not paid | `awaitingPayment` | Awaiting payment | — |
| `status in (assigned, escalated, picked_up)` | `inProgress` | In progress | — |

A blocked fork row collapses to one button because the same ten checks gate
*both* lanes — `assignDirect` runs through `escalate` — so a row missing a
delivery postal code answers Assign with a 422 and Publish with a dialog that
cannot publish. The badge is keyed on `blocked` rather than on the kind, so
"Needs a driver" never sits next to a button that only opens a fix form.

### 2.0 The queue must not list work its buttons refuse

`QUEUE_WHERE.needsDriver` carries `status = 'paid'` alongside
`payment_status = 'paid'`. They are not redundant: 1085 imported rows sit at
`picked_up` with a settled payment, no carrier and no listing, because the lot
was collected outside the system. Without the status half they filled a queue
called "needs a driver" with jobs already in transit — and once the fork
shipped, offered them Assign (a guaranteed `INVALID_TRANSITION`), Publish, and
Cancel-and-re-quote, which would have **succeeded** and wiped the price the
client paid. `ESCALATION_DUE` already pinned `status = 'paid'` for the same
reason; this brings the sibling predicate into line. The queue drops from 1127
rows to 42.

### 2.1 The deadline is shown, not implied

A `needsDriver` row renders the remaining window in the Waiting column:
`auto-publishes in 47 h`, from `escalateAfter`. Under four hours it takes the
amber tone `storageAtRisk` already uses. At or past zero the row is already
`escalate` and this label is not rendered.

`escalationHoursLeft` computes it client-side against the panel's single
memoised `now`, exactly as `storageDaysLeft` already does for the gardiennage
countdown. Which of the two states a row is *in* remains the server's answer
(`queues.escalationDue`); only the size of the gap is rendered here, so the
badge and the queue it came from cannot disagree.

### 2.2 Two primary buttons

`QuoteAction` gains `dialogs: QuoteDialog[]` alongside the existing `dialog`.
For `assign` it is `["assign", "escalate"]`; for every other kind it is the
single existing dialog, or empty. The first entry is the emphasised button.

`escalate` from the `assign` state opens `EscalateDialog` when the row is
escalation-ready, and the fix-and-publish view of `QuoteDetailDialog` when it
is not — exactly the routing `openDialog` does today.

## 3. Capabilities

New in `quote-action.ts`, beside `nextAction`:

```ts
export interface QuoteCapabilities {
  canReprice: boolean;      // publish or change a price
  canAssign: boolean;       // hand to a driver in the pool
  canEscalate: boolean;     // publish to the marketplace
  canEditStorage: boolean;  // free-until date and daily fee
  canRequote: boolean;      // cancel, refund, return to `quoted`
}
export function quoteCapabilities(quote: QuoteRow): QuoteCapabilities;
```

| Capability | True when |
|---|---|
| `canReprice` | `paymentStatus !== 'paid'` **and** `status` not in `delivered, cancelled` |
| `canAssign` | `queues.needsDriver`, `status === 'paid'` **and** escalation-ready |
| `canEscalate` | `queues.needsDriver` **and** `status === 'paid'` |
| `canEditStorage` | status not in `delivered, cancelled` |
| `canRequote` | same as `canAssign` |

`status === 'paid'` is asserted here even though `QUEUE_WHERE.needsDriver` now
carries it too. This is the guard standing between an operator and
`cancelAndRequote`, which unwinds a payment; the cost of the two drifting apart
is a job in transit rewound to `quoted`. Cheap belt to a brace that has already
slipped once.

`canAssign` alone folds in escalation readiness. The overflow keeps every
capability that is not already a primary button, so without it "Assign a
driver" reappeared on precisely the rows §2 collapses to a single Fix — and
assigning them can only 422, since `assignDirect` runs through `escalate`.
`canEscalate` deliberately does not: its click already routes to the fix form
rather than to a publish that would fail.

Both tables read this — `RecentQuotesPanel` and `QuoteQueueTable`. The ⋮ menu
renders only the entries whose capability holds, and a row with none shows no
menu at all. This is a mirror of the server rules in §4 — the server is the
guard; this exists so a button and a 409 never disagree.

## 4. Server rules

### 4.1 Price lock

`expedionService.adminUpdate` refuses, before building the patch:

| Field | Refused when |
|---|---|
| `quoteStandardCents` | `quote.paymentStatus === 'paid'` |
| `quoteInsuredCents` | `quote.paymentStatus === 'paid'` |
| `quoteAvailable` | `quote.paymentStatus === 'paid'` |
| `acceptedPriceCents` | `quote.paymentStatus === 'paid'` |

```
PRICE_LOCKED  409  "This quote has been paid; its price can no longer be edited"
```

Checked on `paymentStatus`, not `status`: a quote can be `escalated` or
`picked_up` and still carry the price it was paid at, and a quote refunded
back to `unpaid` becomes editable again — which is what §4.4 relies on.

Fields the lock does not cover — addresses, coordinates, weight, dimensions,
storage terms — stay editable. They are what `escalationBlockers` demands, and
locking them would strand a paid quote that cannot be published.

**One carve-out: supplying a price the row never had.** `acceptedPriceCents` may
be written when the stored value is null or below `MIN_ESCALATABLE_PRICE_CENTS`,
and only to a value that clears it. The client mirror is
`canSupplyMissingPrice`, and **both** the editable field and `patchToSend` in
`QuoteDetailDialog` gate on it — gating either on `canRepriceQuote` instead
leaves the server carve-out with no caller at all: the field is hidden and the
patch strips the value, so the repair surface this section names cannot reach
it. 16 live rows depend on that path. The lock exists so a recorded amount cannot
drift from what Stripe captured; it is not meant to strand a row carrying no
amount at all — and 95 live paid quotes do, because the Airtable import brought
settled payments across without an accepted price. Those can never escalate, and
after the lock shipped the detail dialog was the only surface that could repair
them and it had just gone read-only. Overwriting a real settled price stays
refused, and the carve-out never extends to the two published figures.

`autoPrice` carries the same guard and returns null for a paid quote. It runs in
the background off `createQuote`, `updateQuote` and `reextractDocument`, and
re-extracting a paid bordereau would otherwise rewrite the very figures
`adminUpdate` refuses to let an operator touch — straight past `PRICE_LOCKED`.

### 4.2 Direct assignment

New: `expedionEscalationService.assignDirect(quoteId, carrierId, actor)`,
behind `POST /api/expedion/quotes/:id/assign` (`requireExpedionAdmin`).

Preconditions, in order:

| # | Check | Error |
|---|---|---|
| 1 | quote exists | `QUOTE_NOT_FOUND` 404 |
| 2 | `paymentStatus === 'paid'` | `QUOTE_NOT_PAID` 409 |
| 3 | no `listingId` | `ALREADY_ESCALATED` 409 |
| 4 | `canTransition(status, 'escalated')` | `INVALID_TRANSITION` 409 |
| 5 | `escalationBlockers(quote)` empty | `ESCALATION_INCOMPLETE` 422 |
| 6 | carrier exists and `status === 'approved'` | `CARRIER_NOT_APPROVED` 409 |
| 7 | carrier has at least one vehicle | `CARRIER_HAS_NO_VEHICLE` 409 |
| 8 | actor holds `operator` or `admin` | `FORBIDDEN_NOT_OPERATOR` 403 |

Check 8 is **before** anything is published, not after. `acceptOffer` checks it
too, but by then `escalate` has already put the job on the marketplace — so a
caller who cannot award would have escalated a quote as a side effect of an
assignment that was always going to be refused. The shared-key auth path is
exactly that caller: its `userId` is whatever `x-expedion-uid` claimed, with no
account behind it.

Then:

1. `escalate(quoteId, { …, directAssignment: true })` — the existing path, so
   there is one quote→listing mapper, not two. The flag sets
   `assigned_directly` and suppresses the "your job is going out to tender"
   text: the client is about to be told a named driver has their job, and
   telling them the opposite first is worse than telling them nothing.
2. `offersService.submitOffer(carrier.userId, listing.id, …)` — **not**
   `offersDal.create`. `submitOffer` is what checks the vehicle can legally
   carry the load (`assertOfferFitsJob`), that the vehicle belongs to this
   carrier, and that the carrier is approved, and it is what maintains
   `listings.offers_count`. Writing the row directly skipped all four.
3. `offersService.acceptOffer(actorUserId, offer.id)` — payment hold, shipment
   creation, rejection of any other offer, and the write-back, all reused.

Steps 2 and 3 are wrapped: an `OfferError` is re-labelled as an `ExpedionError`
carrying the same code and status, plus the id of the listing that is now live.
`expedionErrorResponse` translates only `ExpedionError`, `ExpedionAuthError` and
`ZodError`, so without this every offers-engine and payment failure reached the
operator as a bare 500 reading "An unexpected error occurred" — and each one has
a different next move.

**The listing is `open` between steps 1 and 3.** It is therefore theoretically
visible on `/expedion` for the duration of one service call. Accepted rather
than engineered around: `commitAward` requires `status = 'open'` and takes a
row lock, so a bid landing in that window either loses the lock race or is
rejected by the award like any other losing bid. Adding a "never really on the
market" flag would mean a migration, a second predicate in `browse`, and a
state `acceptOffer` would have to learn about — for a window measured in
milliseconds.

Failure at step 2 or 3 leaves an escalated quote with an open listing. That is
a valid, recoverable state — the job is on the marketplace and drivers can bid
— so it is not compensated. The response says so.

### 4.3 Carrier ids: two id spaces

This is the trap.

| Column | References |
|---|---|
| `expedion_quotes.assigned_carrier_id` | `carriers.id` |
| `offers.carrier_id` | `user.id` |
| `shipments.carrier_id` | `user.id` |

`expedionBridgeService.writeBack` currently assigns `input.carrierId` straight
into `assignedCarrierId`, and its only caller — `onOfferAccepted` — passes
`offer.carrierId`, a **user id**, into a column whose foreign key points at
`carriers.id`.

So today, awarding an escalated job raises a foreign-key violation inside the
write-back. `notifyExpedion` swallows it (`void work.catch(...)`), so the award
succeeds and the Expedion client is never told which carrier won — the quote
sits at `escalated` for good. No dev row has ever been escalated *and* awarded,
which is why this has not surfaced.

The fix: `expedionWriteBackSchema.carrierId` is documented as a **user id**,
and `writeBack` resolves it through `carriersDal.getByUserId` before writing
`assignedCarrierId`. A user id with no carrier row writes `null` and records
the mismatch on the timeline rather than throwing — the write-back must not
fail an award that already happened.

`assignDirect` maps the other way: the picker yields a `carriers.id`, and step 2
needs that carrier's `userId`.

### 4.4 Cancel and re-quote

`expedionService.cancelAndRequote(id, actorId)`, behind
`POST /api/expedion/quotes/:id/requote` (`requireExpedionAdmin`).

| # | Check | Error |
|---|---|---|
| 1 | quote exists | `QUOTE_NOT_FOUND` 404 |
| 2 | `paymentStatus === 'paid'` | `NOT_PAID` 409 |
| 3 | `status === 'paid'` | `NOT_AWAITING_DISPATCH` 409 |
| 4 | no `listingId` and no `assignedCarrierId` | `ALREADY_DISPATCHED` 409 |

Check 3 is not redundant with check 2. 1085 imported rows carry a settled
payment at `picked_up` with no carrier and no listing; gating on `paymentStatus`
alone would rewind a job already in transit to `quoted` and wipe the price the
client paid. `paid` is the only status where the fork is genuinely still open.

In one transaction it sets `paymentStatus = 'unpaid'`, `status = 'quoted'`, and
clears `acceptedKind`, `acceptedPriceCents` and `escalateAfter`. One event,
actor `admin`, message `"Devis annulé et remis en cotation ; remboursement à
émettre"`, metadata carrying the refunded amount, the previous accepted kind,
the Stripe reference, and `refundIssued: false`.

`status` is written directly rather than through `canTransition`. `paid` has no
edge back to `quoted` and must not gain one — rewinding a settled quote is
exactly what the transition graph stops `adminUpdate` doing by accident. It is
legitimate only here, alongside a recorded refund.

**It does not move money, and cannot.** EXPEDITOO never took the client's
payment: `expedion_quotes` carries no payment intent or session, because the
client pays on the Expedion side and that side reports the settlement here (see
`POST /quotes/:id/paid`). `refundService` only knows about `payments` rows —
Expeditoo's own holds against shipments — and there is no such row for a quote
that never reached a shipment. What this does is unwind our record of the
payment and surface the Checkout reference, recovered from the `markPaid`
event, so whoever runs the Expedion Stripe account can refund against it.

**Open:** wiring the refund itself is a payment-server change
(`expedion_encheres/api/`), not one this repo can make. Until it exists, the
money movement is a manual step and the response says so (`refundIssued:
false`).

Condition 3 is the whole point: once a listing or a driver exists, money *is*
held against a shipment on this side too, and unwinding that is a cancellation,
not a re-quote.

## 5. Time zones

`escalate_after`, `assigned_at`, `escalated_at`, `storage_free_until` and
`sale_date` become `timestamp with time zone`.

They are compared against `now()` in `ESCALATION_DUE`, `QUEUE_WHERE.storageAtRisk`
and `findDueForEscalation`, and written from JS. As `timestamp without time
zone` the two disagree by the server's UTC offset — verified locally at +08,
where `markPaid` recorded `2026-08-22T06:13:27.858Z` for a deadline it meant as
14:13, against a `now()::timestamp` of 14:26. Every paid quote was escalation-
due on arrival.

`created_at` / `updated_at` / `requested_at` are left alone: they are written by
`defaultNow()` and only ever read for display.

Migration is a plain `alter column ... type timestamptz using ... at time zone
'UTC'` — existing values were written as UTC wall-clock, so that reading is the
correct one.

## 6. Copy

New keys under `admin.expedion`, FR and EN in step (the parity check is a key
diff, not a reading):

| Key | EN |
|---|---|
| `recent.autoPublishIn` | `auto-publishes in {count} h` |
| `recent.button.assign` | `Assign a driver` (was `Assign`) |
| `actions.assignDirectBody` | `{reference} → {city}. The driver gets the job immediately and the client is told. The price stays {price}.` |
| `actions.requote` | `Cancel and re-quote` |
| `actions.requoteTitle` | `Cancel and re-quote?` |
| `actions.requoteBody` | `{reference} goes back to the client for a new price. The {price} already paid has to be refunded on the Expedion side — this app never took it and cannot return it. There is no undo.` |
| `actions.requoteConfirm` | `Unwind and re-quote` — **not** "Refund and re-quote". The button must not name an action the code does not perform (§4.4). |
| `actions.priceLocked` | `Paid — the price is settled` |

Error copy is **not** translated. `useExpedionQuoteAdmin` and its siblings
surface `error.message` from the server straight into the toast, which is the
pattern every mutation on this page already uses — and each of these messages
names what to do next, which a generic translated string would not. The UI
gates the buttons anyway, so `PRICE_LOCKED` is unreachable from the dashboard.

## 7. Edge cases

| # | Case | Behaviour |
|---|---|---|
| 1 | Two operators assign the same quote at once | `escalate`'s `claimForEscalation` admits one; the loser gets `ALREADY_ESCALATED` 409 |
| 2 | Operator assigns while the cron sweep escalates | Same claim. If the sweep won, the quote is on the marketplace and assignment returns 409 — the operator awards the driver's bid instead |
| 3 | Assign, then the payment hold fails | `acceptOffer` compensates the award; the listing returns to `open` with the quote escalated. Surfaced as a failure, not swallowed |
| 4 | Carrier suspended between picker render and submit | Precondition 6 → `CARRIER_NOT_APPROVED` 409 |
| 5 | No approved carrier at all | Picker empty, existing `actions.noCarriers` copy; Publish is the other button and is unaffected |
| 6 | `markPaid` fires twice | Idempotent on `paymentStatus === 'paid'`; `escalateAfter` is not re-stamped |
| 6b | `markPaid` fires on a quote it cannot legally move to `paid` | `INVALID_TRANSITION` 409, and nothing is written. It used to keep the old status and set `payment_status = 'paid'` anyway — a `quoted` row marked paid, which every capability reads as "nothing to do": unpriceable, undispatchable, not re-quotable, no button. `cancelAndRequote` makes it reachable, because the Expedion success page re-posts `/paid` from `initState` on every mount and the payment server replays it while Stripe still reports the session paid. An operator who deliberately reopened a quote must not have it re-settled by a stale session id |
| 7 | Reprice attempted on a paid quote via the API directly | `PRICE_LOCKED` 409. The UI never offers it, but the UI is not the guard |
| 8 | Re-quote on a quote that was already escalated | `ALREADY_DISPATCHED` 409 |
| 9 | Awarded carrier has no `carriers` row | Write-back records `null` and notes the mismatch; the award stands (§4.3) |
| 10 | `escalateAfter` in the past when the quote is paid late | Row is `escalate` from the start. Correct: the window has already elapsed |

## 8. Test coverage required

**`quote-action.test.ts`**
- `paid`, no carrier, no listing, deadline ahead → `assign`, `dialogs = ["assign","escalate"]`
- same but deadline passed → `escalate`, one dialog
- `quoteCapabilities` for each of: `quoted`, `accepted` unpaid, `paid`, `escalated`, `assigned`, `delivered`, `cancelled`
- `canReprice` false the moment `paymentStatus` is `paid`, true again once it is `unpaid`

**`expedion.service` tests**
- `adminUpdate` throws `PRICE_LOCKED` for each of the four fields on a paid quote
- `adminUpdate` still accepts address, weight and storage fields on a paid quote
- `cancelAndRequote` refunds, clears the three fields, and unlocks repricing
- `cancelAndRequote` refuses with a listing present, and with a carrier present

**`expedion-escalation.service` tests**
- `assignDirect` produces exactly one listing, one offer, one shipment, one hold
- `assignDirect` maps `carriers.id` → `user.id` for the offer
- `assignDirect` twice → the second gets `ALREADY_ESCALATED`
- `assignDirect` on an unpaid quote → `QUOTE_NOT_PAID`
- carrier with no vehicle → `CARRIER_HAS_NO_VEHICLE`, and no listing is left behind

**`expedion-bridge.service` tests**
- `onOfferAccepted` with a user id writes the matching `carriers.id`
- a user id with no carrier row writes `null` and does not throw

**E2E**
- paid → assign → the driver sees the run on `/home` → marks delivered → the
  quote reads `delivered` and the client's timeline shows it

## 9. Not covered here

- The commission split (`ROADMAP.md` §10). Both lanes still hand the driver the
  full `acceptedPriceCents`; payouts cannot go live until it is named.
- Real Stripe hold/capture — this inherits `MOCK_PAYMENTS` from `acceptOffer`.
- Any Expedion-side UI. The client sees the result through the existing
  write-back and the SMS it already sends.
