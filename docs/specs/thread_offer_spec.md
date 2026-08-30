# Specification: Price offers inside a message thread

**Plan:** `docs/plans/plan_thread_offer.md`
**Related:** `docs/specs/offers_engine_spec.md`, `docs/specs/offer_time_slots_spec.md`
**Date:** 2026-08-29

---

## 1. Overview

A transporter chatting with someone can put a **formal price on the table**
without leaving the conversation: a price, one concrete pickup slot, a delivery
lead, and optionally the vehicle. It arrives in the thread as a card, not a
sentence, and the other person can accept it there.

This sits **beside** the free-text composer. Sending an ordinary message is
unchanged.

```
┌──────────────────────────────┐
│ Admin Account                │
├──────────────────────────────┤
│  hey                         │
│      ┌──────────────────────┐│
│      │ OFFRE    En attente  ││
│      │ 180,00 €             ││
│      │ Enlèvement           ││
│      │  ven. 12 sept —matin ││
│      │ Livraison  le lendem.││
│      │ [Accepter] [Refuser] ││
│      └──────────────────────┘│
├──────────────────────────────┤
│ [€] [Message…]          [→]  │
└──────────────────────────────┘
```

### 1.1 One offer, two lanes

The button appears on **every** thread. What the offer *is* depends on whether
the conversation is attached to an open job.

| | **Job lane** | **Standalone lane** |
|---|---|---|
| When | `conversations.listing_id` points at an **open** listing | any other thread — including the `type='SUPPORT'` and "Aucune annonce" cases |
| Creates | a `thread_offers` row **and a real `offers` row** via `offersService.submitOffer` | a `thread_offers` row only |
| Who may send | the offers engine decides (approved carrier, not the owner, no live bid — §5.1) | any participant (§5.2) |
| Accepting | awards through `offersService.acceptOffer` — shipment + payment hold | records agreement in the thread; **no money moves** |
| Status shown | the joined `offers.status` | `thread_offers.status` |

The job lane is the real one: it feeds the existing reverse auction, and the
money path is untouched. The standalone lane is a **record of agreement between
two people** — deliberately inert, and the card says so (§8.4).

### 1.2 Why exactly one pickup slot

`SubmitOfferForm` on the job page lets a carrier propose up to twelve slots,
because an operator comparing bids benefits from choice. A chat offer proposes
**one**, and that is what makes accepting inside the bubble safe:
`offersService.acceptOffer`'s own contract says an offer carrying one slot has
nothing to choose between, so the chat accept passes no `slotId` and cannot
book the wrong one. A second slot picker in the bubble is a non-goal (§10.5).

---

## 2. User stories

- As a **transporter**, I put a price and a date on the table mid-conversation,
  so the client has something concrete to say yes to.
- As a **client**, I accept the offer where I am reading it, and on a job thread
  that single tap awards the job exactly as the job page would.
- As either, I see at a glance whether an offer is still live, accepted,
  refused or withdrawn — without scrolling back or refreshing.

---

## 3. Data model

### 3.1 `thread_offers` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | nanoid |
| `conversation_id` | `text` NOT NULL → `conversations` **cascade** | the thread it lives in |
| `sender_id` | `text` NOT NULL → `user` **cascade** | the transporter |
| `price_cents` | `integer` NOT NULL | 100 … 10 000 000, the offers-engine bounds |
| `pickup_day` | `text` NOT NULL | `YYYY-MM-DD`, as the sender wrote it |
| `pickup_slot` | `time_slot` NOT NULL | reuses the **existing** `time_slot` pgEnum |
| `delivery_lead_days` | `integer` NOT NULL default 0 | 0 = same day |
| `tz_offset` | `integer` NOT NULL default 0 | sender's `getTimezoneOffset()` |
| `pickup_at` | `timestamp` NOT NULL | resolved slot start |
| `delivery_at` | `timestamp` NOT NULL | resolved delivery deadline |
| `note` | `text` | the sender's own words, if any |
| `vehicle_id` | `text` → `vehicles` **set null** | job lane always; standalone optional |
| `offer_id` | `text` → `offers` **set null** | set on the job lane; the bridge to the auction |
| `status` | `thread_offer_status` NOT NULL default `pending` | `pending` \| `accepted` \| `declined` \| `withdrawn` |
| `responded_at` | `timestamp` | when accepted/declined |
| `responded_by` | `text` → `user` **set null** | who accepted/declined |
| `created_at` / `updated_at` | `timestamp` NOT NULL | |

Indexes:

- `thread_offer_conversation_idx` on `(conversation_id)`
- `thread_offer_one_live_per_sender` — **partial unique** on
  `(conversation_id, sender_id) WHERE status = 'pending'`

`offer_id` is `SET NULL`, not cascade: deleting a listing cascades its offers,
and the chat must keep the card rather than lose a turn of the conversation.

### 3.2 `messages.thread_offer_id` (new column)

`text` → `thread_offers` **SET NULL**, nullable.

`thread_offer_id IS NOT NULL` **is the discriminator** — there is no message
kind enum and no JSON payload column. Price, dates and status are read from the
join at render time, so a withdrawn or awarded offer renders its current state
with no message rewrite and no realtime update event.

### 3.3 Deliberately unchanged

`offers`, `offer_slots`, `conversations`, `conversation_participants` and
`listings` are untouched. `sendMessageSchema` and `POST /api/messages` are
untouched.

---

## 4. Validation rules

`createThreadOfferSchema` (`src/server/dto/thread-offers.dto.ts`):

| Field | Rule | Error |
|---|---|---|
| `priceCents` | int, 100 … 10 000 000 | `PRICE_OUT_OF_RANGE` |
| `pickupDay` | matches `^\d{4}-\d{2}-\d{2}$` | `INVALID_DAY` |
| `pickupSlot` | one of `TIME_SLOTS` (derived, never restated) | Zod enum |
| `deliveryLeadDays` | int 0 … 7, default 0 | `DELIVERY_LEAD_OUT_OF_RANGE` |
| `tzOffset` | int −840 … 840, default 0 | Zod |
| `vehicleId` | optional string | |
| `message` | optional, ≤ 1000 chars | |

Cross-field, in `superRefine`, on path `["pickupDay"]`:

- the slot's **end** must be in the future → `SLOT_IN_PAST`. The end, not the
  start, so a driver bidding at 10:00 can still offer this morning — the same
  reading `createOfferSchema` takes.

On the **job lane** the server additionally re-runs the whole offers-engine
validation, because it calls `offersService.submitOffer` with
`slots: [{ day, slot }]` — vehicle ownership, capacity, pickup window, listing
status. Nothing is re-implemented here.

`acceptThreadOfferSchema` has no body.

---

## 5. Permissions

Enforced in `threadOffersService`. Routes resolve the session and pass the id
down; no route inlines a role check.

### 5.1 Sending — job lane

`contextFor` returns `canOffer: false` with a `blockedBy` reason, and the
control renders accordingly (§8.1):

| `blockedBy` | Cause |
|---|---|
| `LISTING_NOT_OPEN` | listing status is not `open` |
| `LISTING_EXPIRED` | `expiresAt <= now` |
| `OWN_LISTING` | the viewer owns the job |
| `NOT_A_CARRIER` | no `carriers` row (this is how a pure `driver` is excluded — by data, not a role list) |
| `NOT_APPROVED` | carrier status is not `approved`. **Includes `suspended`**, which still holds the `carrier` role |
| `OFFER_LIVE` | a `pending` offer already exists on this job |
| `OFFER_SLOT_BURNT` | a `rejected`/`expired`/`accepted` offer occupies the carrier's one slot (§10.2) |

### 5.2 Sending — standalone lane

**Any participant may send.** There is no job to check against, so the app
cannot know which side is the transporter; refusing everyone would make the
button absent on exactly the threads it was asked for. This is a deliberate
consequence of putting the button on every thread, and it is safe: a standalone
offer moves no money and creates no obligation.

Blocked only by `OFFER_LIVE` — one pending offer per sender per thread.

### 5.3 Accepting / declining

- Must be a **participant**, and must **not** be the sender → `NOT_YOUR_OFFER` 403.
- Offer must be `pending` → `OFFER_NOT_PENDING` 409.
- **Job lane** additionally delegates to `offersService.acceptOffer`, which
  enforces owner-for-`direct` and operator/admin-for-`expedion`. Its errors pass
  through unwrapped.

### 5.4 Withdrawing

Sender only, `pending` only. On the job lane it also calls
`offersService.withdrawOffer`, so the auction and the chat stay in step.

### 5.5 Not a participant

`CONVERSATION_NOT_FOUND` **404**, not 403, so conversation ids are not
probeable — the `carrier_trips_spec.md` §5 convention.

> The new path checks participation itself. `messagesService.sendMessage` still
> does **not** (`messages.service.ts:64` computes `isParticipant` and never
> throws). That hole is pre-existing, out of scope here, and materially worse
> now a thread carries prices — see §10.1.

---

## 6. API

All responses use `src/lib/api-response.ts`. `ThreadOfferError` is registered in
`handleError`.

| Method | Path | Body | Success |
|---|---|---|---|
| `POST` | `/api/messages/conversations/[id]/offer` | `createThreadOfferSchema` | `201 { threadOffer, message }` |
| `POST` | `/api/messages/offers/[id]/accept` | — | `200 { threadOffer, shipmentId? }` |
| `POST` | `/api/messages/offers/[id]/decline` | — | `200 { threadOffer }` |
| `POST` | `/api/messages/offers/[id]/withdraw` | — | `200 { threadOffer }` |

`GET /api/messages/conversations/[id]` gains one field on its payload:
`offerContext` (§7).

### 6.1 Error codes

Own codes:

| Code | Status | When |
|---|---|---|
| `CONVERSATION_NOT_FOUND` | 404 | no such conversation, **or** caller is not a participant |
| `THREAD_OFFER_NOT_FOUND` | 404 | no such thread offer, or caller is not a participant of its thread |
| `NOT_YOUR_OFFER` | 403 | accepting/declining your own offer |
| `NOT_YOUR_OFFER_TO_WITHDRAW` | 403 | withdrawing someone else's |
| `OFFER_NOT_PENDING` | 409 | already accepted, declined or withdrawn |
| `THREAD_OFFER_LIVE` | 409 | a pending offer from this sender already exists in this thread |

Passed through **unwrapped** from `offersService` (re-wrapping would lose the
code): `CARRIER_NOT_APPROVED` 403, `LISTING_NOT_FOUND` 404, `LISTING_NOT_OPEN`
409, `LISTING_EXPIRED` 409, `CANNOT_BID_OWN_LISTING` 403, `VEHICLE_NOT_OWNED`
403, `VEHICLE_CAPACITY_WEIGHT` 400, `VEHICLE_CAPACITY_DIMENSIONS` 400,
`PICKUP_OUTSIDE_WINDOW` 400, `OFFER_ALREADY_EXISTS` 409, `OFFER_NOT_FOUND` 404,
`FORBIDDEN` 403, plus every `PaymentError` an award can raise.

---

## 7. `offerContext` — one server-computed gate

`getThread` returns:

```ts
interface ThreadOfferContext {
  lane: "job" | "standalone";
  canOffer: boolean;
  blockedBy: ThreadOfferBlock | null;
  /** Job lane only: what the dialog needs to build a valid bid. */
  job: {
    id: string; title: string; budgetCents: number;
    weightKg: number;
    lengthCm: number | null; widthCm: number | null; heightCm: number | null;
    pickupFrom: string; pickupUntil: string; isFlexible: boolean;
  } | null;
  /** This viewer is who awards this job — mirrors acceptOffer's origin fork. */
  viewerCanAward: boolean;
}
```

The whole visibility decision lives here, so no client re-derives a permission
and all three shells (`/messages`, `/driver/messages`, `/admin/support`) are
correct with zero per-shell wiring. The two role lookups behind `viewerCanAward`
run **only** when `origin === "expedion"` and the viewer is not the owner, so a
direct thread costs no extra query.

**A failing gate costs the button, not the conversation.** `getThread` wraps the
call and returns `offerContext: null` on any error, logging it. The offer button
is an addition to a surface people already depend on; without this containment
an unapplied `0018` would take every thread in the app down with it, and the
symptom — per CLAUDE.md gotcha 9 — would be a blank chat titled "Chargement…".

---

## 8. Screen behaviour

### 8.1 The trigger

A `€` icon button in the composer row of `MessageDetail`, immediately left of
the text input — the first second action that row has ever had. It renders:

- `canOffer` → the button, opening the dialog.
- `OFFER_LIVE` → a muted line above the composer naming the situation. The
  sender's own card carries the **Withdraw** action, so the way out is visible.
- `OFFER_SLOT_BURNT` → a muted line linking to `/listing/{id}`.
- any other `blockedBy` → **nothing at all**. A rendered-then-disabled control
  invites a support ticket; absence with a reason, or clean absence, does not.

### 8.2 The dialog

`Dialog` (14 precedents in the repo; `Drawer` has zero). Fields:

1. **Vehicle** — job lane: required, `Select` over `useVehicles()`, with
   too-small and inactive vehicles shown **disabled with a reason** rather than
   hidden. Standalone lane: the field is omitted entirely.
2. **Price (€)** — defaults to the job's budget on the job lane, empty on the
   standalone lane. Over budget shows a warning, not an error: the budget is the
   ceiling the margin comes out of, not a cap.
3. **Pickup** — one day (Calendar) + one period (morning/afternoon/evening
   toggle). On the job lane the calendar disables days outside the pickup
   window, pre-empting `PICKUP_OUTSIDE_WINDOW` rather than hitting it.
4. **Delivery** — same day / J+1 / J+2 / J+3 toggle.
5. **Message** — optional, ≤ 1000 chars.

Zero vehicles → `CenteredEmptyState` with a CTA to `/carrier/fleet`. A *failing*
fleet fetch gets its own retry branch, distinguished from an empty one
(CLAUDE.md gotcha 9).

### 8.3 The card in the thread

Keeps `ChatBubble`'s rhythm — same gap, same side, same avatar, same timestamp
and read ticks — but renders a bordered card instead of a flat bubble, widened
to `max-w-[19rem] sm:max-w-sm`. Own-side cards take `border-primary/40` rather
than inverting to `bg-primary`, which would make the price unreadable.

Rows: label + status badge · price in `font-mono tabular-nums` · pickup day and
period · delivery · vehicle (when present) · the note (when written) · actions.

Status badges are painted **entirely from the `@theme inline` token map** — no
hex, no bare palette class, no `dark:` override stacked on a token:

| Status | Treatment |
|---|---|
| `pending` | `bg-muted text-muted-foreground border-border` |
| `accepted` | `bg-success/15 text-success border-success/30` |
| `declined` / `rejected` / `expired` | `bg-destructive/10 text-destructive border-destructive/30` |
| `withdrawn` | `bg-muted text-muted-foreground`, price struck through |

### 8.4 Actions on the card

| Viewer | Lane | Shows |
|---|---|---|
| recipient, `pending` | job, `viewerCanAward` | **Accept** · **Decline** |
| recipient, `pending` | job, not the decider | muted `An operator decides on this job.` |
| recipient, `pending` | standalone | **Accept** · **Decline** |
| sender, `pending` | either | **Withdraw** |
| anyone, settled | either | the badge alone |

A standalone accept carries the line **"Agreed in the chat — no payment is
taken."** so nobody reads it as a booking.

---

## 9. Realtime

`newMessageEventSchema` gains `threadOfferId: string | null | undefined`.
`content` stays a plain string, so no existing consumer changes. No new channel
and no new event name.

`useMessageDetail`'s handler branches at the top: when `threadOfferId` is set it
**invalidates and refetches** rather than injecting a synthesised bubble,
because price, dates and status come from a join the event does not carry.
Without that branch the recipient would see a bare `180,00 € · ven. 12 sept`
text bubble until their next refetch.

With Ably off, the offer appears on the next thread fetch and the inbox row
still rises, because `createMessage` bumped `lastMessageAt`.

---

## 10. Known limitations

1. **`POST /api/messages` still accepts any signed-in user** who knows a
   conversation id — `messagesService.sendMessage` computes `isParticipant` and
   never throws on it. The new endpoints do check. Filed, not fixed here.
2. **The burnt offer slot.** `offer_one_live_per_carrier` excludes only
   `withdrawn`, so a `rejected` or `expired` offer occupies a carrier's one slot
   on that listing **forever**, and `listingsService.updateListing` expires
   pending offers on any material edit. The chat surfaces this honestly
   (`OFFER_SLOT_BURNT`) but cannot fix it — that is a ROADMAP-level change to
   the offers engine, and chat will hit it far more often than the job page.
3. **A double-tapped job-lane submit can 500.** `submitOffer`'s duplicate check
   is a read; nothing catches the Postgres unique-index violation, so the loser
   of a race surfaces as `INTERNAL_ERROR` rather than 409. Pre-existing on
   `POST /api/listings/:id/offers`. Mitigated only by disabling the button while
   pending and closing the dialog on success.
4. **`vehicle.isActive` is not checked server-side** by
   `assertVehicleFitsJob` — only greyed out in the form. Inherited, not created.
5. **`POST /api/messages/init` performs no relationship check**, so any signed-in
   user can attach any `listingId` to any pair. A carrier could therefore post a
   job-lane offer into a thread with a stranger; the offer still lands correctly
   on the job, only the chat notification goes somewhere odd. Pre-existing.
6. **A standalone offer is inert.** Accepting records agreement and nothing
   else — no shipment, no payment, no tracking. §1.1.

---

## 11. Non-goals, stated so they are not re-litigated

1. A `messages.kind` enum or JSON payload column. The FK answers "is this an
   offer" and dereferences to the live row.
2. Encoding the card into `messages.content`. Three consumers print `content`
   verbatim — the inbox snippet, `/api/admin/support-chats`, and
   `toClientMessage` in `/api/expedion/support` — and all three would show raw
   JSON. The stored `content` is the sender's note, or a short human summary.
3. Multi-slot chat offers, and therefore a slot picker in the bubble. §1.2.
4. A withdraw-then-resubmit "revise" flow. Non-atomic by construction: a refused
   resubmit strands the carrier with no offer at all. Withdraw, then send again.
5. A job picker for standalone threads. `offers.listing_id` is NOT NULL and
   letting a carrier attach an arbitrary job from an unrelated chat is worse
   than the standalone lane.
6. Any refactor of `offers.service.ts` or `offers.dto.ts` — both were just
   rewritten for offer slots.
7. Translating `useSubmitOffer`'s hardcoded-English `SUBMIT_MESSAGES` map.

---

## 12. Test coverage required

**`src/server/services/__tests__/thread-offers.service.test.ts`**

- `contextFor`: `lane: "standalone"` with `canOffer: true` for a null-listing
  thread and for a SUPPORT thread — **and no carrier/offer DAL call is made**.
- `contextFor` job lane: each of `LISTING_NOT_OPEN`, `LISTING_EXPIRED`,
  `OWN_LISTING`, `NOT_A_CARRIER`, `NOT_APPROVED` (for a **suspended** carrier
  who still holds the role), `OFFER_LIVE`, `OFFER_SLOT_BURNT`; and `canOffer`
  with the exact `job` projection otherwise.
- `viewerCanAward`: true for the shipper on `direct`; true for `operator` and
  `admin` on `expedion`; false for a random participant; and **`hasRole` is not
  called at all** when `origin === "direct"`.
- `submit`: `CONVERSATION_NOT_FOUND` for a missing conversation **and** for a
  non-participant, with an identical code so ids are not probeable; takes the
  listing id from the conversation and **never** from the input; calls
  `submitOffer` with exactly one slot; passes an `OfferError` through unwrapped;
  writes one message carrying `threadOfferId`; standalone lane never touches
  `offersService`.
- `accept`: `NOT_YOUR_OFFER` for the sender; delegates to `acceptOffer`
  **without a `slotId`** on the job lane; standalone accept moves no money.
- `withdraw`: sender only; job lane also calls `offersService.withdrawOffer`.

**`src/app/api/messages/conversations/[id]/offer/__tests__/route.test.ts`**

- 401 with no session; 400 `VALIDATION_ERROR` with `issues[]` for a bad day;
  400 with `issues[0].message === "SLOT_IN_PAST"`; 409 and 403 codes passed
  through intact rather than degrading to 500; 201 envelope on the happy path.

**UI (`src/features/app/messages/ui/__tests__/`)**

- `ThreadOfferAction`: renders the trigger when `canOffer`; renders `null` for
  each silent `blockedBy`; renders the `alreadyBid` line for `OFFER_LIVE`.
- `ThreadOfferBubble`: every status renders its own badge copy; `withdrawn`
  strikes the price; Accept/Decline render only for the recipient on a pending
  offer; the sender sees Withdraw instead; `operatorDecides` renders when the
  viewer cannot award; the standalone accepted card carries the no-payment line.
- Both bilingual — `describe.each([["fr", fr], ["en", en]])` inside
  `NextIntlClientProvider` fed the **real** catalogues, with an `onError` spy
  asserted never called and no raw key path in `container.textContent`.

**Gates:** `src/db/__tests__/migrations-journal.test.ts` and
`src/i18n/__tests__/locale-parity.test.ts` both pass unedited;
`npx vitest run src/server/services/__tests__/offers.service.test.ts` stays
green, proving the offers engine was not touched.
