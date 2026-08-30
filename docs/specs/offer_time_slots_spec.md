# Spec — multiple time slots on an offer

**Plan:** `docs/plans/plan_offer_time_slots.md` ·
**Amends:** `docs/specs/offers_engine_spec.md` §1, §3, §5

## 1. What this is

A carrier's offer names **when they can do the job**, and until now it could
name exactly one moment: a single `estimatedPickup` datetime. The client's ask,
against the Cocolis *Faire une offre* screen, is that a transporter be able to
enter **several** time slots.

The reference message reads *"possibilité de livrer vos biens le 25/08 en
journée"* — a day and a time of day, not a clock time. That is the unit here:

> **A slot is one day plus one time of day.** An offer proposes between one and
> twelve of them, and whoever awards the job books exactly one.

The vocabulary is the board's own — `morning` / `afternoon` / `evening` from
`src/lib/availability-window.ts`, already translated FR/EN. A driver who
filtered the board to "2 and 3 September, mornings" proposes in the same words
they searched in.

## 2. Entity

`offers` gains one column:

```
delivery_lead_days   integer not null default 0    -- 0 = the same day, 1 = J+1, …
```

and a child table:

```ts
offer_slots {
  id           text pk
  offerId      text not null -> offers.id  on delete cascade
  day          text not null               // YYYY-MM-DD, no timezone, by design
  slot         time_slot not null          // morning | afternoon | evening
  startsAt     timestamp not null          // resolved instant, slot start
  endsAt       timestamp not null          // resolved instant, slot end
  deliveryAt   timestamp not null          // what this slot promises delivery by
}

UNIQUE (offer_id, day, slot)
INDEX  (offer_id)
```

`time_slot` is a Postgres enum **derived** from `TIME_SLOTS`, not a second copy
of the list (CLAUDE.md gotcha 8).

**Why both the words and the instants.** `day` + `slot` is what the driver
actually said, and it renders identically wherever it is read. `startsAt` /
`endsAt` / `deliveryAt` are what the server compares against the listing's
window and what becomes the shipment's schedule — resolved **once**, at submit,
in the driver's timezone, so no later reader needs to know what that was.

**`offers.estimated_pickup` / `estimated_delivery` stay, and stay `NOT NULL`.**
They hold the **booked** slot: the earliest proposal while the offer is pending,
and the chosen one once it is awarded. Every existing reader — `pickup_asc`
sorting, `MyOffers`, `OfferCard`, the shipment row, the Expedion write-back —
therefore keeps working with no change.

## 3. Submitting

`POST /api/listings/:listingId/offers`

### Input

```ts
{
  vehicleId: string,
  priceCents: number,                  // unchanged
  slots: { day: string, slot: TimeSlot }[],   // 1..12, over at most 4 distinct days
  deliveryLeadDays: number,            // 0..7, default 0
  tzOffset: number,                    // the client's getTimezoneOffset()
  message?: string,                    // ≤ 1000 chars
}
```

`estimatedPickup` and `estimatedDelivery` are **gone from the wire**. They are
derived (§3.3). This is a rename-not-alias change, per CLAUDE.md gotcha 6.

### 3.1 Validation — input alone (DTO)

| Rule | Failure |
|---|---|
| 1 ≤ `slots.length` ≤ 12 | `400 TOO_MANY_SLOTS` / `400 SLOTS_REQUIRED` |
| At most 4 distinct days | `400 TOO_MANY_SLOT_DAYS` |
| No repeated `(day, slot)` pair | `400 SLOT_DUPLICATE` |
| `day` matches `YYYY-MM-DD` | `400 SLOT_DAY_INVALID` |
| Every slot's **end** is in the future | `400 SLOT_IN_PAST` |
| 0 ≤ `deliveryLeadDays` ≤ 7 | `400 DELIVERY_LEAD_OUT_OF_RANGE` |

`SLOT_IN_PAST` tests the slot's **end**, not its start: a driver bidding at
10:00 can still offer this morning, and that is the honest reading of "I can do
it this morning". It replaces the offer DTO's old `PICKUP_IN_PAST` (the
listing-side rule of that name, in `listings.service.ts`, is untouched), and
`DELIVERY_BEFORE_PICKUP` is gone — §3.3 makes it unrepresentable.

### 3.2 Validation — needs the listing (service)

**Every** proposed slot must overlap `[listing.pickupFrom, listing.pickupUntil]`
unless `listing.isFlexible`, else `400 PICKUP_OUTSIDE_WINDOW`.

*Overlap, not containment* — the same rule the board filter applies
(`board_route_search_spec.md` §5). A morning (06:00–12:00) against a window
opening at 09:00 is a real proposal, and refusing it would mean a driver could
not offer the first morning of any job.

*Every, not any* — an offer is refused whole rather than having a slot silently
dropped.

Because the refusal is whole, the form must not be able to *propose* a slot this
rule would reject. A calendar gates whole **days**; this rule and `SLOT_IN_PAST`
are decided per **slot**. `offerablePeriods(day, window, now, tzOffset)` asks the
same question at the same granularity, and the form uses it three ways: a day
with no offerable period is closed in the calendar, a newly added day defaults to
its offerable periods only, and the rest are shown disabled. Without it, a job
collecting 09:00–11:00 on one day would default that day to "en journée" and lose
the driver the whole bid to a rule they never saw.

Vehicle capacity is unchanged.

### 3.3 What gets stored

Slots are resolved with `tzOffset` (the client's `getTimezoneOffset()`, added
back to build UTC instants — production runs `TZ=UTC`, so without it a French
driver's 06:00 lands at 08:00), then sorted by `startsAt`:

| Slot | Local hours |
|---|---|
| `morning` | 06:00 – 12:00 |
| `afternoon` | 12:00 – 18:00 |
| `evening` | 18:00 – 22:00 |

**Delivery.** One control, not a second calendar: the lead says how many days
after collection the goods arrive, and the promise is the **end of that day**,
22:00 local — the latest hour this vocabulary knows.

```
deliveryAt = 22:00 local on (slot.day + deliveryLeadDays)
```

So a morning pickup on 25/08 delivered "le jour même" promises 25/08 22:00, and
at J+1, 26/08 22:00. `deliveryAt > startsAt` always holds, because every slot
starts at 18:00 or earlier — which is why `DELIVERY_BEFORE_PICKUP` no longer
needs to exist.

The offer row then takes its schedule from the **earliest** slot:
`estimatedPickup = slots[0].startsAt`, `estimatedDelivery = slots[0].deliveryAt`.

### 3.4 The empty slot list

`slots: []` means *"no proposal — the job's own window"*, and stores
`estimatedPickup = listing.pickupFrom`, `estimatedDelivery = listing.dropoffFrom`
with no `offer_slots` rows.

**Only internal callers can produce it.** The DTO requires at least one slot, so
no request can. It exists for the two lanes where nothing is being proposed:

- `offersService.takeJob` — the driver takes the job as posted; there is no
  negotiation on price and none on timing either.
- `expedionEscalationService.assignDirect` — an operator assigns from the pool.

Both previously passed `listing.pickupFrom` / `listing.dropoffFrom` by hand.
That knowledge now lives once, in the service that already has the listing row.

## 4. Awarding

`POST /api/offers/:id/accept` — body `{ slotId?: string }`, and an absent body
is valid.

| Case | Booked slot |
|---|---|
| `slotId` names a slot on this offer | that slot |
| `slotId` absent | the earliest slot — already the offer's stored pair |
| the offer has no slots | the listing's window — the offer's stored pair |
| `slotId` names a slot on another offer, or nothing | `400 SLOT_NOT_ON_OFFER` |

Booking happens **inside `commitAward`'s transaction**, under the same listing
lock that stops two carriers winning one job:

1. `offers.estimated_pickup` ← `slot.startsAt`,
   `offers.estimated_delivery` ← `slot.deliveryAt`.
2. The shipment is created with `scheduledPickup` / `scheduledDelivery` read
   from the offer row **after** that write.

Step 1 is what makes the booked slot the answer everywhere without a second
column: `OfferCard`, `MyOffers`, the carrier's shipment list and the Expedion
write-back all already read that pair. The `offer_slots` rows are left intact,
so what was proposed is still legible beside what was booked.

The response carries the offer row **as written** — the return value of the
status update, which is after the schedule write — so it cannot disagree with
the database or with the shipment travelling beside it.

`compensateFailedAward` does **not** restore the previous schedule. A job whose
payment was declined goes back on the board with every bid intact, and the
carrier's offer keeps pointing at the slot the operator tried to book — which
is the slot they will try again.

## 5. Screens

### 5.1 The driver — `OfferSlotsField` inside `SubmitOfferForm`

Replaces the two `datetime-local` inputs.

- A popover calendar adds a day. A day with **no offerable period** is closed —
  which covers "before today", "outside the client's window" (unless the job is
  flexible), and "today, but every period of it has already ended". At the
  four-day cap the unchosen days are closed too, while the trigger stays live so
  a day can be swapped rather than silently dropped.
- Each chosen day is a row with a three-way toggle: **Matin · Après-midi ·
  Soir**, multi-select. A new day arrives with **every offerable period**
  selected — "en journée" where the whole day is on offer, narrower on a
  boundary day — and the driver narrows it further. Periods the server would
  refuse are shown **disabled**, not hidden, for the reason the vehicle select
  shows a van that is too small: a control that vanishes reads as a broken form.
- Removing every period on a day removes the day. There is no invalid state to
  report, so there is no error to render.
- Every DTO refusal code has a carrier-facing sentence. They arrive as
  `VALIDATION_ERROR` with the real code inside `issues[].message`, so the toast
  reads that list and not only `error.code`.
- Below, one row of radio-style toggles for the delivery lead: **Le jour même ·
  J+1 · J+2 · J+3**. The schema allows up to seven; nobody proposing a week out
  is proposing a slot.

No summary line. `AvailabilityField` needs one because its selection is folded
into a popover trigger; here the rows are the summary — each names its day and
shows which periods are pressed.

Submit is disabled while no day is chosen, exactly as it was while a datetime
was empty.

### 5.2 Whoever awards — `OfferCard`

- With one slot: a line, as today.
- With several and no permission to accept: the list, read-only.
- With several and permission to accept: a radio group, the earliest
  pre-selected, and the accept button posts that slot. The button reads
  "Accepter ce créneau" rather than "Accepter" so it is clear what is being
  agreed to.
- **The schedule line follows the selection.** It reads the slot currently
  chosen, not the offer's stored pair, or the awarder would read one date and
  commit to another.
- Days are rendered from the slot's own `day` string, never from its instant. An
  instant renders in the *viewer's* timezone, so a 06:00 Paris pickup would name
  a different day to an operator reading it from another one — which is the
  whole reason the row stores the words as well as the instants.

`canAccept` already covers the owner of a direct job and the operator on an
escalated one; nothing about who may award changes here.

## 6. Non-goals

- **No counter-proposal.** The award picks one of the driver's slots or does
  not award. There is no negotiation loop, and no way for the client to suggest
  a slot the driver did not offer.
- **No per-slot price.** One offer, one price. A driver who wants more for a
  Sunday can say so in the message.
- **No rescheduling after award.** Once booked, the shipment's schedule is a
  shipment concern.
- **No fourth period.** "Toute la journée" is all three selected, not a new
  enum value — the board filter would have to learn it too.
- **DST.** One `tzOffset` is sent for the whole proposal, so slots straddling a
  changeover are an hour out on the far side. Two days a year, one hour, on a
  half-day window; the alternative is resolving twelve instants client-side.

## 7. Test coverage required

- [x] A day plus a period resolves to the right UTC instants under a negative
      `tzOffset` (Paris in summer)
- [x] Slots come back sorted by start, whatever order they were entered
- [x] `deliveryAt` is 22:00 local on the lead day, and always after the start
- [x] Duplicate `(day, slot)` pairs are rejected
- [x] More than four distinct days is rejected; twelve slots over four days is not
- [x] A slot already ended is rejected; one that started but has not ended is accepted
- [x] A slot outside a non-flexible listing's pickup window is refused with
      `PICKUP_OUTSIDE_WINDOW`; the same slot on a flexible listing is accepted
- [x] A slot merely *overlapping* the window is accepted
- [x] The offer's stored schedule is the earliest slot's
- [x] `takeJob` stores the listing's own window and writes no slot rows
- [x] Accepting with a `slotId` schedules the shipment from that slot and
      rewrites the offer's pair
- [x] Accepting with no `slotId` uses the earliest slot
- [x] A `slotId` belonging to another offer is refused
- [x] `OfferSlotsField` defaults a newly added day to its offerable periods, and
      dropping the last period drops the day
- [x] `offerablePeriods` drops a period the window cannot take, drops one that
      has ended, keeps one that has started, and ignores the window when the job
      is flexible
- [x] A period the window cannot take renders disabled in the field
- [x] The day cap explains itself without locking the calendar shut
- [x] `isOfferSlotDay` rejects a well-shaped but impossible date (`2026-02-31`)
- [x] `addDays` crosses month and year boundaries as a day string
