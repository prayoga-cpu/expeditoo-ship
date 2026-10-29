# Client feedback of 28–29 October 2026 — spec

Status: **current** (2.66.0 onwards). Plan:
`docs/plans/plan_client_feedback_2026_10_29.md`. Monitor: the top of
`STATUS.md`, one row per item.

Nicolas answered the nine questions sent on 28 October and added two features;
the driver field test added eight requirements. The consolidated document
(`EXPEDITOO Client Feedback Consolidated 29.10.2026.pdf`) checked every item
against `main` at `d842bbb` (2.65.0). This spec fixes the behaviour of
everything built from it. Where the client left a choice open, the choice made
is in §0 so it can be overruled cheaply.

---

## 0. Readings chosen without the client

| | Item | Reading built | Why |
|---|---|---|---|
| A | B5 « Immédiat » — « l'enlèvement peut se faire tout de suite » | **Derived**: open, still taking offers, and the pickup window has already opened (`pickupFrom ≤ now < pickupUntil`) | The same shape as « Urgent »: no box to forget to untick. Only a flexible request can be in that state while it takes offers — a fixed one stops 6 h before its window opens |
| B | B5 — both badges at once | « Immédiat » and « Urgent » are independent; a window open since yesterday that closes tomorrow wears both | They answer different questions: *can I go now* and *must it be done soon* |
| C | B3 « annonce directe » | The tag reads **« Site Expeditoo »** (EN « Expeditoo site ») beside « via Expedion »; the hover text is unchanged | Léa's question is still outstanding; this names the inlet rather than a box someone ticked, and costs one string to change |
| D | A4 « initiales » | The **requester's** initials, beside their name, on the staff tables only | The cities already have their own columns; the drivers' board never says who posted a job |
| E | REQ-02 « Absent » | **Not a status.** Two columns, `absent_since` / `absent_until`; absent while set and the return date is unset or ahead | An absence ends on a date. A status would need a sweep to flip it back, and the sweeps have never run in production (X1) |
| F | REQ-02 « Désinscrit » | A status, `deregistered`. Refused while a run is still owed; every standing bid withdrawn; money earned stays payable; applying again is reviewed again | A delivery in progress is never stranded, and no requester goes on comparing an offer nobody will honour |
| G | REQ-07 « professional application » | **Every** submitted application alerts the admins | Every applicant today holds a SIRET; the professional / private split waits on REQ-01 |
| H | C3 Apple Pay / Google Pay | Wallets `auto` in the accept dialog; PayPal not built | Both wallets are cards to Stripe, so the manual-capture intent is unchanged. PayPal is a redirect method with its own capture and saving rules, and needs enabling on the account first |
| I | B1 « a new state between assigned and paid » | **Not a status.** `offers.proposed_at` marks Expeditoo's pick; the requester pays through the existing accept dialog, which is the award | A new listing or shipment status would need every reader of those enums to learn it; a recommendation that awards nothing needs none of them |
| J | B6 who negotiates | The **requester** sends a counter-price; the **carrier** answers (accept / keep / another price). Direct requests only; five counter-prices per offer | An escalated job's price was paid in Expedion; a cap keeps the loop from becoming a chat |
| K | B6 « suggested price range » | The platform's own rate card (`pricingService`, the one that prices Expedion quotes), ±15 %, rounded to 5 € — **only** where that engine applies (≤ 100 kg, ≤ 300 cm) | A range from an engine that does not price furniture would be invented |
| M | N4 what « a problem reported at delivery » is | An **unresolved** incident on the job, category `damage`, `cargo_mismatch`, `safety` or `other`, reported by the requester (`shipper`) or staff | The goods, not the logistics; and never the driver's own report, which would let a driver hold their own pay |
| N | N3 « automatic payout when the status becomes Delivered » | Released **48 h after** delivery by an hourly sweep, through Stripe Connect, site lane only | The client needs time to report a problem, or the hold of N4 could never act; an escalated job's money is in Expedion's Stripe account |
| O | N7 when to text | The requester's message to a driver about the job, at most one text per 30 minutes per thread; every accepted offer. Never the message's words | An SMS sits on a lock screen |
| L | N1 « changeable later by either side » | **Not built** in 2.67.0: the accept dialog shows the delivery days and times before paying; changing dates after booking still goes through the conversation | A reschedule flow touches the shipment dates, the driver's plan and the Expedion write-back; it is its own release |

---

## A2. Supervision: reverse order, period, every quote

**Was.** « Récents » was the report's 25 newest quotes. The toolbar's
« Choisir une période » filtered those 25 in the browser, so a period before
the newest 25 found nothing. The order could be flipped only by a header arrow.

**Now.**
- `GET /api/admin/expedion/quotes?from&to&order&page&limit` →
  `listQuotePage(viewer, query)` (staff only, `FORBIDDEN` 403 otherwise) →
  `reportDal.getQuotePage`. `from` / `to` are **instants** (ISO with offset):
  the browser turns the days it shows into its own midnights, `to` being the
  day after the last day picked, exclusive. `order` `asc|desc` (default
  `desc`), `page` ≥ 1, `limit` 1–100 (default 25). A window whose end is not
  after its start is `VALIDATION_ERROR` 400.
- A quote with no `requested_at` is outside every window and last in either
  order. Ties break on `id`, as the queues do.
- « Récents » reads 100 at a time from it, with « 1–100 sur N » and previous /
  next. The tab count is the total.
- Each tab has its own order and a button that turns it round: « À traiter »
  opens oldest first, « Récents » newest first. The table's sort arrow follows.
- « À traiter » is complete in the browser and keeps the client-side period
  filter; « Récents » uses the server's window.
- A failed page shows the error and « Réessayer », never a blank table.

## A4. The reference is the number alone

- `formatListingReference(reference)` → `"100018"`. `cityCode` is gone.
  `ListingReference` takes no cities.
- `parseListingReference` still drops « PAR-CLA- » in front of a number, so a
  reference copied off a 2.65.0 screen or email still finds its job.
- `/admin/listings` reads, left to right: **N° · Départ · Arrivée · Demandeur**
  (name, email, initials) · Titre (origin tag, time badges) · Prix · Statut ·
  Vues · Créé.
- `/admin/shipments` reads **N° · Départ · Arrivée · Demandeur · Titre ·
  Chauffeur · Statut · Prix · Créé**. `shipmentsDal.adminOverview` adds the
  requester's **name only** (`listing.shipper.name`) — never an email, a phone
  or a Stripe id. A run with no job has no requester (« — »).
- Initials: `initialsOf(name, email)`, moved to `src/lib/initials.ts`.

## B3. The origin tag

« Directe » → « Site Expeditoo » / « Expeditoo site ». The hover text
(`directHint`) is unchanged. Revisit when Léa's question arrives.

## B5. « Immédiat » beside « Urgent »

- `isImmediate(job, now)` in `src/lib/urgency.ts`: `stillOpen` (status `open`
  and, when `expiresAt` is given, not past it) and `pickupFrom ≤ now <
  pickupUntil`.
- `isUrgent` gains the same `stillOpen` test: an `open` row past its bidding
  deadline is one the expiry sweep has not reached, and reads « Expirée »
  (`displayStatus`), not « Urgent ».
- `UrgencyBadge` (renamed from `UrgentBadge`) renders « Immédiat » (amber,
  lightning) and/or « Urgent » (destructive, flame), or nothing. Same places as
  before: board cards, job page, « Mes demandes » (all three views), the admin
  listings, the award queue.

## C3. Apple Pay and Google Pay

- `AcceptPaymentDialog`'s Payment Element: `applePay: "auto"`, `googlePay:
  "auto"`, `link: "never"`. Server unchanged: `payment_method_types: ["card"]`,
  `capture_method: "manual"`, the same metadata checks on capture and release.
- Apple Pay appears only once the serving domain is registered under Stripe →
  Settings → Payment method domains (Operator to-do). Until then Stripe leaves
  the button out.
- **Not verified with a real wallet.** Test mode in a headless browser cannot
  present Apple Pay or Google Pay.

## N2. « Mes livraisons »: order, period, dates

- `/driver/shipments` (`MyShipments`): the status filter, plus an order button
  (« Plus proches d'abord » default / « Plus lointaines d'abord ») and a period
  field. Both read one date per run, `listDate` (`src/features/app/driver/lib/
  shipment-list.ts`): delivery done or due, else pickup done or due, else the
  day it was booked.
- Each row shows « Retrait prévu / Retiré {date} » and « Livraison prévue /
  Livré {date} », actual before planned.
- A failed load shows « Impossible de charger vos expéditions » (gotcha 9).

## N5. « Mes paiements » from the deliveries screens

A « Mes paiements » button to `/carrier/withdrawals` on `/driver/shipments` and
`/carrier/trips`, **for an account holding `carrier` only** — a driver-only
account is never shown pay (roles_spec.md).

## REQ-02. Actif / Absent / Suspendu / Désinscrit

**Statuses.** `carrier_status` gains `deregistered` (migration `0042`).
« Actif » is `approved`, relabelled in the admin; « Suspendu » is `suspended`.
`carriers` gains `absent_since`, `absent_until`, `absence_reason`,
`deregistered_at`, `deregistration_reason`, all nullable.

**The rule** (`src/lib/carrier-availability.ts`):
- `isAbsent(c, now)` — `absentSince` set, and `absentUntil` unset or after
  `now`.
- `mayTakeWork(c, now)` — `status === "approved"` and not absent. Every
  new-work path asks it: `offersService.submitOffer` (`CARRIER_ABSENT` 403),
  the award checks in `acceptOffer` / its validation (`CARRIER_ABSENT` 409),
  `takeJob` (through `requireApprovedCarrier`), the thread-offer gate
  (`CARRIER_ABSENT`, the button renders nothing), `assignDirect`
  (`CARRIER_ABSENT` 409), `carrierService.requireApproved`, and the
  « Transporteurs disponibles » match (`sharedCandidateConditions`, the SQL
  twin of `isAbsent`).
- An absent driver keeps their live runs, their payouts, their documents and
  their vetted view of jobs they hold.

**Transitions.**

| From | To | Who | Route | Refusals |
|---|---|---|---|---|
| Actif | Absent | driver, admin | `PUT /api/carrier/availability`, `PUT /api/admin/carriers/:id/availability` `{absent:true, until, reason}` | `CARRIER_NOT_ACTIVE` 409 unless approved; `ABSENCE_END_IN_PAST` 422 |
| Absent | Actif | driver, admin, or the date | same, `{absent:false}` | — |
| Actif / Suspendu | Désinscrit | driver (reason optional), admin (reason 3–1000) | `POST /api/carrier/deregister`, `POST /api/admin/carriers/:id/deregister` | `CARRIER_HAS_LIVE_RUNS` 409 while a shipment is `PENDING`/`ASSIGNED`/`PICKED_UP`/`IN_TRANSIT` |
| Suspendu | Actif | admin | `POST /api/admin/carriers/:id/reinstate` | `FORBIDDEN` 403; `NOT_SUSPENDED` 409 |
| Désinscrit | Soumise | driver | `POST /api/carrier/application/submit` | — (clears `deregistered_at` / reason) |

- A caller naming another driver's id who is not an admin gets
  `CARRIER_NOT_FOUND` 404, never 403.
- Deregistering withdraws every `pending` offer and decrements each job's
  `offers_count` in the same transaction; deregistering twice is a no-op.
- An admin acting on someone else's account notifies them in the app.

**Screens.** Admin dialog: an approved driver offers « Marquer absent » (return
day, optional reason) or « Fin d'absence », « Suspendre », « Désinscrire »
(reason required); a suspended one « Désinscrire » and « Réactiver ». The badge
reads « Absent » (amber) for an approved driver who is away. The driver's own
file shows « Disponibilité »: « Je m'absente » / « Je suis de retour » and
« Me désinscrire », each saying what it keeps and what it stops. A deregistered
driver's file is editable and can be submitted again.

## REQ-07. The admins hear about every application

`submitApplication` notifies **every admin** in the app (`/admin/applications`)
and by email (`DriverApplicationSubmittedEmail`: applicant name, company, town,
a link — no SIRET, no documents). Best-effort: a failed alert never fails the
submission. Until a Resend domain is verified (C4) the email reaches only the
Resend account's own address; the in-app notification reaches everyone.

## B1. Expeditoo's pick on a direct request

- `offers.proposed_at` / `proposed_by` (migration `0043`).
- `POST /api/offers/:id/propose` → `offersService.proposeOffer(viewer, id)`:
  staff only (`FORBIDDEN_NOT_OPERATOR` 403); the offer `pending`
  (`OFFER_NOT_PENDING` 409); the job `open` with no award
  (`LISTING_NOT_OPEN` 409); **direct** only (`PROPOSAL_NOT_AVAILABLE` 409 — an
  operator awards an escalated job outright); the carrier `mayTakeWork`
  (`CARRIER_ABSENT` 409). One pick per job: every other offer's pick is
  cleared in the same transaction. The requester is notified in the app.
- `DELETE /api/offers/:id/propose` → `withdrawProposal`, staff only.
- **Nothing is awarded and no card moves.** The requester's card is the
  accept dialog's, unchanged; the proposed card reads « Choix Expeditoo », is
  outlined, says « Expeditoo a sélectionné ce transporteur pour vous », and its
  button reads « Payer pour confirmer ».
- `proposedBy` never leaves the server: `withoutProposer` strips it from the
  requester's and the carrier's views. The carrier's pending card says
  Expeditoo recommended their offer.
- The award queue's direct cards with bids say to open the request to propose.

## B6. The negotiation

- **Range.** `/create`'s Budget step shows « Prix conseillé : 85 € – 115 € »
  and « Utiliser 100 € » when `suggestionRequest` can ask the engine (both
  pins, a weight bracket, a size, ≤ 100 kg, ≤ 300 cm); otherwise nothing. The
  engine's refusal is no suggestion, never a form error.
- **Price to publish, « Faire une offre ».** Already there (`budgetRequired`,
  `SubmitOfferForm`, the thread offer).
- **Counter-price.** `offers.counter_price_cents` / `counter_note` /
  `countered_at` / `counter_rounds`. `POST /api/offers/:id/counter
  {priceCents, note}` → `counterOffer`: the job's owner (`FORBIDDEN_NOT_SHIPPER`
  403), direct only (`COUNTER_NOT_AVAILABLE` 409), none already pending
  (`COUNTER_PENDING` 409), fewer than `MAX_COUNTER_ROUNDS` = 5
  (`COUNTER_LIMIT_REACHED` 409), not the current price (`COUNTER_SAME_PRICE`
  422), bid bounds (`PRICE_OUT_OF_RANGE`). The carrier is notified.
- **Answer.** `POST /api/offers/:id/counter/respond {action}` →
  `respondToCounter`: the offer's carrier (`FORBIDDEN` 403), a counter pending
  (`NO_COUNTER_PENDING` 409), `mayTakeWork` (`CARRIER_ABSENT`). `accept` sets
  `price_cents` to the counter, `decline` keeps it, `revise {priceCents}` sets
  the carrier's new price; every answer clears the counter. The requester is
  notified. Writes are conditional on `status = 'pending'`, so an answer that
  loses a race to the award changes nothing (`OFFER_NOT_PENDING`).
- **What is paid** is `price_cents` when the requester accepts. A price that
  moves while the accept dialog is open is refused at capture
  (`PAYMENT_INTENT_MISMATCH`, `authorisedFeeFor` checks the amount) and the
  authorisation released; the dialog says the price changed.

## N1. What is booked, before the card

`AcceptPaymentDialog` takes a `booking` node; on the job page it is
`BookingSummary`: the slot being booked, the delivery it promises (the offer
card's own labels), and the requester's delivery days and times from `/create`
(`dropoff_days` / `dropoff_periods`) — or that none were set. Changing dates
after booking is not built (§0 L).

## D2. « Carte » is a map

- **« Mes demandes »** gains a fourth view, `map` (« Carte », remembered like
  the others): `RequestsMap`, loaded only when chosen. The requests listed
  beside a map of their routes (pickup pin with the budget, a dashed line to
  the delivery). Choosing a row zooms onto its two ends (max zoom 13) and
  reveals « Ouvrir la demande »; choosing a pin picks and scrolls to its row;
  « Voir toutes les demandes » reframes. Requests with no pin are listed and
  counted, not plotted. The pins are the requester's own — nobody else's job
  reaches this view.
- **The board search** (`RouteSearchBar`): « Partir de ma position » fills the
  departure from `navigator.geolocation` (rounded to 4 decimals, never stored
  beyond the board's URL; refused or unavailable → a toast); « Retour au
  départ » sets the arrival to the departure — a one-point corridor reads as
  the circle around it (`corridorPath`), so a round trip needs no special case;
  `SearchAreaThumbnail` draws the area (circle, or trajet) and opens the
  board's map on click. `BoardMap` draws the « Autour de » circle
  (`circleRing`, geodesic) and frames it.
- The radius in km, the optional arrival and the corridor were already there
  (`board_route_search_spec.md`).

## N3. Automatic payout, after the hold

- `payoutReleaseService.releaseDue(now)` from `GET /api/cron/release-payouts`
  (hourly at :20, `scheduled-jobs.yml`; registered in `CRON_JOBS`, so
  « Tâches planifiées » shows it).
- **Releasable** (`withdrawalsDal.releasable`): what the balance would count
  (delivered, captured, unclaimed, undisputed) **and** delivered ≥
  `PAYOUT_HOLD_HOURS` = 48 ago, **and** `payments.source = 'stripe'` with a
  real intent (never `pi_mock_`), **and** the driver's `user.stripe_account_id`
  set with `stripe_account_status = 'active'`. 50 per run.
- Each: `claimForRelease` (`scheduled` → `processing`, no `withdrawalId`; a
  withdrawal request that claimed it first wins); `stripe.transfers.create`
  to the driver's account, `source_transaction` = the client's charge so it
  may go before funds settle, idempotency key `payout_release_<id>`;
  `markReleased` (`processing` → `paid`, transfer id, `paid_at`) and the
  driver's « paid » email. A refused transfer → `releaseClaim` (back to
  `scheduled`, reason kept) — **never `failed`**, which would drop earned money
  out of the balance.
- **Inert** until the crons run (X1), the platform account may create
  connected accounts, and a driver finishes Connect onboarding. Until then
  every payout stays in the withdrawal flow as before.

## N4. A reported problem holds the payout

- `DISPUTED` (`withdrawals.dal.ts`): an incident on the payout's shipment with
  `status <> 'RESOLVED'`, category in `damage | cargo_mismatch | safety |
  other`, `reported_by_role` in `shipper | operator | admin`.
- `availableFor` / `availableRows` exclude disputed payouts, so a withdrawal
  request cannot claim them; `heldFor` sums them and the earnings screen says
  « {amount} en attente : un problème a été signalé… ». `claimedPayouts`
  carries `disputed`; `payoutStanding` reads it as `held` — not payable, not
  void — so recording a transfer for a request whose job was disputed after
  the request is refused (`WITHDRAWAL_HAS_INVALID_PAYOUT`) and a refusal puts
  it back in the balance. The release sweep (N3) excludes it too.
- Resolving the incident (operator, `/admin/incidents`) releases it. Nothing
  here touches `payments`: the client's money was captured at booking.

## N6. An email for every payout

`payoutNoticesService`: `earned` from `settleDelivery` after `schedulePayout`
(in-app + `PayoutEmail` kind `earned`); `paid` after `mark_paid` and after an
automatic release (kind `paid`, the transfer reference). Best-effort; never
thrown. The email reaches only the Resend account's own address until C4.

## N7. Texts to the driver

`driverSmsService` over the bridge's Twilio sender:
- `onNewMessage` from `messagesService.sendMessage`, not awaited: only when the
  sender is the conversation's job's `shipperId` and the recipient has a
  `carriers` row with a phone; skipped when the same sender wrote in the same
  thread less than `MESSAGE_SMS_QUIET_MS` = 30 min before. The text names the
  job and links the thread — never the message.
- `onOfferAccepted` from `notifyAwardOutcome`: the winner, a link to the job.
- Answers `TWILIO_NOT_CONFIGURED` and sends nothing until the `TWILIO_*`
  variables exist.

---

## Test coverage required

- `urgency.test.ts`: `isImmediate` inside / before / after the window, past the
  bidding deadline, every non-open status, immediate *and* urgent;
  `isUrgent` past the bidding deadline.
- `listing-reference.test.ts`: the bare number; the retired « PAR-CLA- » form
  still parsed.
- `DeliveriesTable.test.tsx`: column order N° · Départ · Arrivée · Demandeur,
  initials, no route letters.
- `shipment.admin-overview.test.ts`: the requester's name in the row.
- `quotePageQuery.test.ts`: local midnights, exclusive `to`, open-ended sides.
- `expedion-quote-page.test.ts`: staff only, window/order/offset passed
  through, defaults, a reversed window and an oversized page refused.
- `shipment-list.test.ts`, `MyShipments.test.tsx`: dates read actual before
  planned, order both ways, inclusive window, « Mes paiements » for carriers
  only, the error state.
- `CarrierTripsScreen.test.tsx`: « Mes paiements » for carriers only.
- `carrier-availability.test.ts`: `isAbsent`, `mayTakeWork` for every status,
  `driverStanding`.
- `carrier-availability.service.test.ts`: every transition and refusal in the
  table above, the stranger's 404, offers withdrawn, the admin alert on
  submit and its failure contained.
- `AvailabilitySection.test.tsx`, `CarrierApplicationDetail.availability.test.tsx`:
  every button above, the return day sent as local midnight, the deregister
  reason required of an admin.
- `offers.negotiation.test.ts`: every refusal of `proposeOffer`,
  `counterOffer` and `respondToCounter` above; the pick cleared on the other
  offers; `proposedBy` absent from the result; the race lost to the award.
- `OfferNegotiation.test.tsx`, `CounterResponse.test.tsx`, `OfferCard.test.tsx`:
  propose / withdraw, the counter sent in cents, the same price refused, the
  waiting state, the round cap, the three answers, « Payer pour confirmer ».
- `price-suggestion.test.ts`: the request built from brackets and presets,
  typed numbers with a comma, nothing asked outside the engine's range, the
  ±15 % range to 5 €.
- `BookingSummary.test.tsx`: the booked slot and its delivery day, the
  requester's availability, the no-availability line.
- `geo-circle.test.ts`: the ring closes, reaches the radius due north, and is
  wider in longitude than latitude at Paris.
- `RequestsMap.test.tsx`: framed on load, zoom onto a chosen row, the open
  link, a pin picking its row, the unpinned count.
- `RouteSearchBar.test.tsx`: « Ma position » rounded with a radius, « Retour au
  départ », no thumbnail without a departure.
- `withdrawals.service.test.ts`: `held` standing, a transfer refused for a job
  disputed after the request, the held total in the balance.
- `WithdrawalPanel.test.tsx`: the held line, and none when nothing is held.
- `payout-release.service.test.ts`: the hold passed to the query, the transfer
  funded from the charge with an idempotency key, a payout claimed meanwhile
  skipped, a refused transfer returned to the balance, nothing due.
- `payout-notices.service.test.ts`: earned in-app + email, paid with the
  reference, failures contained, no email without an address.
- `driver-sms.service.test.ts`: requester → driver only, no job, not a driver,
  the 30-minute quiet, the award text.
- All new raw SQL run on a fresh database with every migration applied
  (`releasable`, `heldFor`, `claimedPayouts`, `claimForRelease`,
  `lastMessageAtBefore`, `getQuotePage` with and without a window).

