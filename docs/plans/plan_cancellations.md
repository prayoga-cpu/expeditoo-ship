# Plan — Cancellations from both sides

**Spec:** `docs/specs/cancellations_spec.md`
**Date:** 2026-09-05

The client asked for cancellations to be handled **from both sides — by the
transporter or by the requester**. Today there is one endpoint, one code path
and no branch on who is asking: `shipmentService.cancelShipment` admits shipper,
carrier, driver and staff alike, refunds, and sets the listing to `cancelled`.
The transporter is kept out of it only by a boolean in a browser hook.

---

## 1. The shape of the answer

**They are two verbs, not one.**

| | **Cancel** | **Withdraw** |
|---|---|---|
| Who | the requester, or an operator | the transporter (the carrier who won) |
| Means | *the job is off* | *this transporter is off; the job survives* |
| Listing | `cancelled` | back to `open`, window re-armed, rival bids restored |
| Money | refunded | refunded — nobody holds money for a driverless job |
| Expedion | quote → `cancelled` | quote → `escalated`, carrier cleared |
| The client hears | "votre transport est annulé" | "votre transporteur s'est désisté, nous cherchons un remplaçant" |

Today both roads end at `listingsDal.update(listingId, { status: "cancelled" })`,
which is why a van breaking down destroys a job the client still wants and still
paid for. `offersService.revokeAward` already implements the withdraw *shape* —
refund, rivals restored, listing back to `open` — and its own comment names this
exact gap. It is operator-only, unreachable from any UI, writes nothing back to
Expedion, and hands the re-opened job straight to the expiry cron. Withdraw is
that method finished and given to the person it belongs to.

**Nobody adjudicates before pickup.** A driver whose van is dead at 06:00 must be
able to hand the job back at 06:00; making them wait for an operator to approve
it burns the only hours the job can still be saved. Accountability comes from the
record — a side, a category and an actor stamped on the row — not from a gate.

**After pickup, neither side may act alone.** The goods are in someone's vehicle.
`CANCEL_REQUIRES_SUPPORT` stays for both sides, and the existing incident lane
(`vehicle`, `access`, `safety`, `cargo_mismatch`) is how either party reaches an
operator. What changes is that the support lane finally *works*: today an
operator who takes it hits `INVALID_STATUS_TRANSITION`, because
`TRANSITIONS.IN_TRANSIT` has no `CANCELLED` edge — the carve-out at the top of
`cancelShipment` is defeated four lines later.

---

## 2. Schema

One hand-written migration, `0021_cancellations.sql` (0019 and 0020 were taken
by concurrent work). `pnpm db:generate` is banned; the journal entry needs a
`when` strictly above the current tail.

- `shipment_cancellation_side` — `requester | transporter | operator`. Not
  `actor_role`: `carrier` and `driver` are one commercial side, and `recordEvent`
  collapses `staff → admin` so the event row cannot answer this.
- `shipment_cancellation_category` — eleven values, fenced per side by Zod.
- `shipments.cancelled_by_side`, `.cancellation_category`,
  `.cancelled_by_user_id`, `.cancelled_by_ref`. The last pair copies
  `shipment_confirmations` verbatim and for the same reason: an Expedion quote
  owner has no `user` row, so a foreign key alone cannot record who asked.
- `listings.reopened_at` — a job another driver dropped is not the job that was
  posted. Its window has moved and a bidder is entitled to know.

**Not added:** no cancellation-fee column (there is no fee — §7), no new
`offer_status`, no new `listing_status`, no new `expedion_quote_status`, no
cancellation-request table. Every transition this feature needs is already legal.

---

## 3. Server

`cancelShipment` **moves out of** `shipment.service.ts` into a new
`shipment-cancellation.service.ts`. It has to: it calls `offersService` to
un-award, and `listingsService` already imports `offersService` — the same cycle
that produced `shipment-access.ts` and `message-publish.ts`.

- `cancelJob(shipmentId, input, actor)` — the requester's and the operator's verb.
- `withdrawFromJob(shipmentId, input, viewer)` — the transporter's verb.
- `reopenForRebid(listingId, tx)` on `offersService` — `compensateFailedAward`
  plus the two things it forgets: a re-armed `expires_at` (without it the 15-minute
  expiry cron eats the job and every bid just restored) and a pickup window pushed
  forward when the original has passed.
- `src/lib/cancellation-policy.ts` — pure predicates shared by the service and the
  hooks, so the four disagreeing cancellability rules in the repo become one.

Money, unchanged in shape and corrected in one place:

- Both verbs refund. Nobody holds a client's money for a job with no driver.
- An escalated job's money is Expedion's: `REFUND_NOT_LOCAL` is caught **by name**
  and turned into a refund-owed event on the quote timeline, the way
  `cancelAndRequote` already records one. Any other failure is caught too — a
  cancellation must never fail on money — but is stamped on the event as
  `refundFailed`, so a dead Stripe call is visible to support instead of living
  in a server log.
- `recordExternalCharge` becomes idempotent **per listing**. Today a re-award
  after a withdrawal would write a second `captured` `expedion` row for the same
  quote and inflate recorded revenue.

The back door closes: `PATCH /api/shipments/:id/status` accepts `"CANCELLED"`
today and reaches a path with no refund, no reason and a listing left live. The
value comes out of the route enum, out of the driver client's write union, and
`updateStatus` refuses it outright.

---

## 4. Bridge

`expedionBridgeService` gains two methods, because `writeBack`'s carrier spread
is conditional on a truthy id and so can only ever *set* `assigned_carrier_id`,
never clear it.

- `onAwardWithdrawn` — quote → `escalated`, `assigned_carrier_id`, `assigned_at`
  and `assigned_directly` cleared together. All three: a row with a listing, no
  carrier and `assigned_directly` still true falls out of **both** buckets of the
  escalation-rate KPI and vanishes from the funnel.
- `onJobCancelled` — quote → `cancelled`, plus the refund-owed event.

Both text the client. `expedionSmsService` has no cancellation message today, and
the one recipient with no account is the one who most needs telling.

---

## 5. Client

- **Transporter**: a withdraw dialog inside `PendingActions` and
  `AssignedActions` — inside, never at the `ShipmentActions` level, which the
  detail page mounts twice.
- **Requester**: the existing cancel dialog gains the category select and stops
  closing before the mutation resolves, so a refusal is more than a toast.
- The accidental second route closes: a self-assigned carrier resolves to
  `"carrier"` and is currently shown the *client's* cancel button, with the
  client's copy, on `/deliveries/[id]`.
- `roleFor` stops falling through to `"shipper"`, which today shows an operator
  the requester's wording.
- Both surfaces render who cancelled and why, not just the free-text line.

---

## 6. Translations

New `shipments.stop.*` (one dialog serving both sides, one label per category) and
`driver.actions.withdraw.*`. Plus `notifications.types.shipment_cancelled`,
`shipment_withdrawn`, `job_reopened`.

Two existing strings are wrong and are fixed here, in both catalogues:
`deliveries.cancelFeedback.success` says the held payment was *released* — there
has been no hold since payment-at-booking — and `help.faq.q3.answer` promises
cancellation fees that do not exist.

---

## 7. Order of work

1. Migration + schema + journal.
2. `cancellation-policy.ts`, the DTO, the cancellation service.
3. `reopenForRebid`; `revokeAward` delegates to `withdrawFromJob`.
4. Payments: `refundForJob`, per-listing external idempotency.
5. Bridge + SMS.
6. Routes; close the back door.
7. Notifications.
8. UI both sides; i18n.
9. Tests, then the four gates.

---

## 8. Deliberately not done

- **No cancellation fee, no penalty, no strike count.** The money stack cannot
  express one honestly: both refund call sites omit Stripe's `amount`, `payments`
  has no column to hold a retained figure, payouts stop at `scheduled`, and the
  commission split is still undecided (`ROADMAP.md` §10). The side, the category
  and the actor are recorded so a policy can later be written against real data
  rather than a guess. `carriers.cancelled_jobs` is the natural next column.
- **No adjudication queue.** A post-pickup cancellation goes through an operator
  and the incident lane already reaches every operator and admin. A second queue
  covering the same event is not worth its staffing.
- **No signed-link cancellation.** The confirmation token is mailed to people with
  no account and lives 30 days; its entire safety argument is that it grants
  nothing. It must not gain a lever.
- **The Flutter side.** `stageFromApiStatus` has no `cancelled` case, so a
  cancelled quote reads *"En attente"* on the client's card. That is a change in
  `expedion_encheres`, and it belongs in the same release — recorded in the spec's
  known limitations, not silently assumed.
