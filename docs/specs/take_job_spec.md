# Spec — Taking a job at its budget: escalated jobs only

**Plan:** `docs/plans/plan_take_job.md` · **Release:** 2.60.0
**Amends:** `request_posted_page_spec.md` §3–§4, `pay_at_accept_spec.md` §2
and §3.3, `offer_time_slots_spec.md` §3.4.

**Decided (2026-10-04, feedback item 12):** _"it's approved, go ahead with your
suggestion"_, answering the question the 2.59.0 operator to-do put to the
client: may an approved carrier take a **direct** request outright at its
budget? The suggestion on record was to restrict taking to Expedion jobs
(`STATUS.md`, 2.59.0 → Known limits). The owner confirmed that reading.

---

## 1. Rule

« Prendre cette course » — a carrier taking an open job at its posted budget,
with no bidding and no waiting to be picked (`offersService.takeJob`, 2.26.0) —
works **only on a job whose `origin` is `expedion`**.

On a direct request, posted at `/create`, the requester **always** chooses the
offer and pays for it in the accept dialog (`AcceptPaymentDialog`,
`pay_at_accept_spec.md`). A carrier who wants that job makes an offer, and the
offer form opens on the budget.

Why the two inlets differ:

- An **escalated** job is owned by the Expedion system account, which nobody
  signs into. It has nobody of its own to choose: an operator awards in the
  client's place, and the client already paid in Expedion. A driver who accepts it as
  posted skips nobody's decision. The client asked for exactly that in 2.26.0
  ("but still can monitor & control by admin side"), and everything built
  around it is on the operator's side: `offers.self_accepted`, the award queue
  (Expedion jobs only), operator-only revocation.
- A **direct** request has a requester. A take awarded their job without them
  and charged their **saved** card off-session with nobody at the keyboard
  (or, with no saved card, failed `PAYMENT_METHOD_REQUIRED` and left a pending
  bid behind). No notification told them — `notifyAwardOutcome` notifies
  carriers only — so the emailed receipt was the first they heard of it.
  Direct requests had picked the take up by omission: `/create` was restored
  ten hours before 2.26.0 shipped, and nothing in it checked the origin.

## 2. `POST /api/listings/:id/take` → `offersService.takeJob`

Session required (`401 UNAUTHENTICATED`). Body `{ vehicleId: string (min 1),
message?: string (trimmed, max 500) }`, unchanged. The route holds no rule of
its own; `handleError` translates every `OfferError`.

Checks, in this order:

| # | Check | Failure |
|---|---|---|
| 1 | Listing exists | `404 LISTING_NOT_FOUND` |
| 2 | `status === 'open'` | `409 LISTING_NOT_OPEN` |
| 3 | `expiresAt` in the future | `409 LISTING_EXPIRED` |
| 4 | **`origin === 'expedion'`** | **`409 TAKE_NOT_AVAILABLE`** — new |
| 5 | `submitOffer`'s own checks: approved carrier, not their own job, their vehicle, the vehicle fits, one live offer | `403 CARRIER_NOT_APPROVED`, `403 CANNOT_BID_OWN_LISTING`, `403 VEHICLE_NOT_OWNED`, `400 VEHICLE_CAPACITY_*`, `409 OFFER_ALREADY_EXISTS` |

Then, unchanged: the offer is created at `budgetCents` with `slots: []`
(`offer_time_slots_spec.md` §3.4), marked `self_accepted` (best-effort), and
awarded through `acceptOffer({ selfAward: true })`.

**Response `201`:** `{ offer, shipment: { id }, alreadyAccepted }` — the
accept route's answer (`offers_engine_spec.md` §5): the carrier's own offer as
a row, `selfAccepted: true`, and the shipment's id. Not the rest of what
`acceptOffer` returns. Its `rejectedOffers` are every other bidder's pending
offer — their price, their message (phone numbers included), their vehicle
and user id — and spreading the award into the response handed them to the
driver who took the job, on every successful take. The `payment` row, with the
platform's commission, stays behind too.

**Before `submitOffer`, so a refused take writes nothing**: no offer, no
`offer_slots` row, no `offers_count` bump, no "new offer" notification to the
requester, no `self_accepted` mark, no payment.

**409, not 403.** The carrier is not forbidden this job — they may bid on it.
They used the wrong lane for it, which is the same shape as
`USE_WITHDRAW_ENDPOINT` (`cancellations_spec.md` §5.2) and
`PAYMENT_NOT_REQUIRED` (`pay_at_accept_spec.md` §3.2), and like the first, the
message names the verb that works: make an offer.

**It fails closed.** The test is `origin !== 'expedion'`, not
`origin === 'direct'`: a value nobody anticipated is refused rather than let
through. The column is `NOT NULL DEFAULT 'direct'`, and it is stamped once —
`direct` on every `/create` job (`toInsert`, `listings.service.ts`), `expedion`
by escalation — and is on no update schema, so a job never changes lane after
it is posted.

**The listing checks come first.** A closed or expired direct job answers
`LISTING_NOT_OPEN` / `LISTING_EXPIRED`, as it did; the origin is asked only of
a job that is still open. An unapproved carrier on a direct job is told
`TAKE_NOT_AVAILABLE`, not `CARRIER_NOT_APPROVED`: approval would not change the
answer, so naming it would mislead.

## 3. The self-award gate — `acceptOffer({ selfAward: true })`

The flag skips `assertMayAward`, the gate that keeps a direct job's award with
its requester. It is honoured only when **all three** hold:

```ts
opts.selfAward === true &&
existing.carrierId === actorUserId &&
listing.origin === "expedion"
```

| Flag | The offer is the actor's | Origin | Result |
|---|---|---|---|
| set | yes | `expedion` | self-award: no role check |
| set | yes | `direct` | the ordinary gate, which refuses a carrier: `403 FORBIDDEN_NOT_SHIPPER` |
| set | no | any | the ordinary gate, unchanged |
| absent | — | — | the ordinary gate, unchanged |

The ordinary gate is `assertMayAward`: the job's owner, and on an escalated
job an operator or admin; anyone else `403 FORBIDDEN_NOT_SHIPPER` (direct) or
`FORBIDDEN_NOT_OPERATOR` (escalated).

Only `takeJob` passes the flag, and §2 refuses a direct job before any offer
exists, so the second row is unreachable today. It is the **second line**: a
future caller that passes the flag on a direct job is refused by the
requester's own gate instead of awarding the job.

## 4. Money

- **Escalated job, unchanged.** `chargeForShipment` with `source: "expedion"`
  records the client's Expedion payment (`recordExternalCharge`) and calls
  Stripe for nothing (`payment_at_booking_spec.md` §2.1).
- **Direct job: no take, so no off-session charge from one.** The requester
  pays when they accept, in the dialog, on-session
  (`pay_at_accept_spec.md` §3).
- **The off-session saved-card branch of `chargeForShipment` stays.** It is
  now reachable only by the requester calling `POST /api/offers/:id/accept`
  without a `paymentIntentId`; no screen does. It is kept because
  `pay_at_accept_spec.md` §3.3 and §6 pin it, and removing a charge path is its
  own change.

## 5. UI

`JobBidSection` (the job page's bidding surface, `JobDetail`):

| Viewer | Direct job | Escalated job |
|---|---|---|
| signed out, the job's owner, or the job not `open` | nothing | nothing |
| no `carrier` role | `BecomeCarrierCard` | same |
| a submit refused `CARRIER_NOT_APPROVED` | `NotApprovedCard` | same |
| carrier | **`SubmitOfferForm` only** | `TakeJobPanel`, then `SubmitOfferForm` |

Only the last row changes.

`TakeJobPanel` itself is unchanged, and still renders nothing for a carrier
with no vehicle that fits. `SubmitOfferForm` is unchanged; its price opens on
the budget, so offering the posted price on a direct job is one vehicle and one
slot away.

`useTakeJob` names `TAKE_NOT_AVAILABLE` (§6). The panel is not shown on a
direct job, so this toast answers only a request the page did not make; it
says what to do instead rather than "please try again".

### The origin can now be inferred — accepted

The take panel appears on escalated jobs and not on direct ones, so a driver
can tell where a job came from by whether it is there.
`expedion_source_hidden_spec.md` §4 keeps "`listings.origin` and every
behaviour it drives: who awards …" and removes only labels; who may take a job
is that kind of behaviour. Nothing added here names Expedion: not the panel,
not the error. Rejected alternatives: removing take everywhere (drops the
2.26.0 feature the client asked for), and a look-alike "offer at the budget"
panel on direct jobs (UI with no capability behind it — the form already opens
on the budget).

## 6. Copy

| Key | FR | EN |
|---|---|---|
| `listing.bid.errors.TAKE_NOT_AVAILABLE` (new) | Ce client choisit lui-même son transporteur : faites-lui une offre. | This client chooses their carrier: make an offer instead. |
| `create.budget.hint` | C'est une estimation, pas une limite : les transporteurs peuvent proposer plus ou moins, et vous choisissez l'offre que vous acceptez. | It's an estimate, not a cap: carriers can offer more or less, and you choose the offer you accept. |
| `create.success.next.choose` | Vous comparez les offres et choisissez votre transporteur. | You compare the offers and choose your carrier. |
| `create.success.next.pay` | Vous ne payez qu'au moment où vous acceptez une offre. | You only pay when you accept an offer. |

The last three drop what 2.59.0 added to stay truthful about direct takes
(« Un transporteur peut aussi accepter directement votre demande à ce prix »,
« à moins qu'un transporteur n'accepte directement votre demande »,
« ou quand un transporteur accepte votre demande à votre budget »). Their
sentences are true again only together with §2, so **the copy and the guard
ship in the same release**: the hint and the thank-you page render only for
`/create` jobs, which are always `direct`.

`dashboard.cardNudge.description` (« Vous paierez au moment d'accepter une
offre… ») is unchanged and is now true without exception.

## 7. Edge cases

| # | Case | Behaviour |
|---|---|---|
| 1 | A carrier calls `/take` on a direct job (a script, an old tab) | `409 TAKE_NOT_AVAILABLE`, nothing written, toast « Ce client choisit lui-même son transporteur : faites-lui une offre. » |
| 2 | Two drivers take one escalated job at once | Unchanged: one wins, and the other is refused by `takeJob`'s own listing check or by `commitAward`'s lock |
| 3 | A direct job is closed or expired | `LISTING_NOT_OPEN` / `LISTING_EXPIRED`, before the origin is asked |
| 4 | A bid a direct take left behind before 2.60.0 (the take failed `PAYMENT_METHOD_REQUIRED`) | Still a pending bid the requester may accept in the dialog. It keeps `self_accepted = true`, which nothing reads (§8) |

## 8. Known limits

- **A driver can infer the origin** from the take panel (§5). Accepted.
- **`self_accepted` is marked before the award and not cleared if the award
  then fails.** The commonest such failure was the direct lane's
  `PAYMENT_METHOD_REQUIRED`, which this removes; on the escalated lane the
  charge is recorded, not taken. Nothing reads the column yet, so it skews no
  number today.
- **The losers of a take are told "The shipper chose a different offer"**
  (`notifyAwardOutcome`, hardcoded English). On an escalated job no shipper
  chose. Unchanged here.
- **The take footnote promises an operator can "see and reverse" a take.**
  Nothing reads `self_accepted`, and `offersApi.revokeAward` has no UI caller.
  Unchanged here.

## 9. Test coverage required

`src/server/services/__tests__/offers.service.test.ts`:

- [ ] On an escalated job, a take is priced at the budget, not at a price the
      caller names.
- [ ] On an escalated job, the offer is marked `self_accepted`.
- [ ] The take answers exactly `offer` (`selfAccepted: true`), `shipment:
      { id }` and `alreadyAccepted`: no rival's id, vehicle, price or message,
      no payment row, no street from the shipment (§2 Response).
- [ ] On an escalated job, the award goes through with the carrier holding no
      operator role (the self-award branch, not a role left over from another
      test), and the client's Expedion payment is recorded (`source:
      "expedion"`), not charged.
- [ ] On a direct job, `TAKE_NOT_AVAILABLE`, and `submitOffer`,
      `offersDal.create`, `markSelfAccepted` and `chargeForShipment` are never
      called.
- [ ] It fails closed: an origin the enum does not have is refused
      `TAKE_NOT_AVAILABLE`.
- [ ] An escalated job that is no longer open answers `LISTING_NOT_OPEN` (the
      two-drivers race), and an unapproved carrier `CARRIER_NOT_APPROVED`.
- [ ] A closed **direct** job answers `LISTING_NOT_OPEN`, not
      `TAKE_NOT_AVAILABLE`: the listing checks come first.
- [ ] `acceptOffer({ selfAward: true })` by the offer's own carrier on a direct
      job → `FORBIDDEN_NOT_SHIPPER`. Kept: without the flag →
      `FORBIDDEN_NOT_SHIPPER`; the flag on someone else's offer →
      `FORBIDDEN_NOT_SHIPPER`.

`src/features/app/listing/ui/__tests__/JobBidSection.test.tsx` (children stood
in for):

- [ ] A carrier on a direct job is shown the offer form and no take panel.
- [ ] A carrier on an escalated job is shown both, the take panel first.

`src/features/app/create/__tests__/RequestPostedScreen.test.tsx` reads
`next.choose` and `next.pay` from `fr.json`, so it follows §6 unchanged.

Locales: the four keys of §6 in both `messages/fr.json` and `messages/en.json`,
at exact key parity.
