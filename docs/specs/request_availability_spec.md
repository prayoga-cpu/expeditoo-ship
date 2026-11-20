# Spec — weekdays and times of day on a request

**Plan:** `docs/plans/plan_create_form_feedback.md` · **Release:** 2.59.0

**Reported (2026-10-02, `#5-FSXWN_`):** "FORM PAGE3 — below the two lines of the
date (pickup and delivery), put horizontally names of days of the week with
checkbox already checked. About availability, add possible to morning and
afternoon (and also evening): not only one."

The French subtitle of `/create` already asked the requester to check
« la disponibilité des personnes intervenant au retrait et à la livraison
(jours de la semaine et tranches horaires) »; the form had no place to say it.

## 1. Model

Each end of a request (pickup, delivery) carries:

| Field | Shape | Meaning |
|---|---|---|
| `days` | ISO weekdays, `1` = Monday … `7` = Sunday; 1–7 entries, unique, ascending | the days someone is there |
| `periods` | subset of `TIME_SLOTS` (`morning` 06–12, `afternoon` 12–18, `evening` 18–22); 1–3 entries, unique, in that order | the times of day someone is there |

**The full set means "no restriction"** — all seven days, all three periods.
« N'importe quand » *is* all three periods: there is no fourth state. Both are
**preferences** of a flexible request (`isFlexible: true`); an exact request
always carries the full sets.

ISO numbering is the one `carrier_routes.days_of_week` already uses;
`ISO_WEEKDAYS` and `isoWeekday(date)` move to `src/lib/availability-window.ts`
beside `TIME_SLOTS`.

## 2. Storage — `0035_listing_availability.sql`

```sql
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_days"     jsonb DEFAULT '[1,2,3,4,5,6,7]'::jsonb NOT NULL;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_periods"  jsonb DEFAULT '["morning","afternoon","evening"]'::jsonb NOT NULL;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_days"    jsonb DEFAULT '[1,2,3,4,5,6,7]'::jsonb NOT NULL;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_periods" jsonb DEFAULT '["morning","afternoon","evening"]'::jsonb NOT NULL;
```

jsonb typed with `$type<…>()`, as every list column in the schema is (no
Postgres arrays, no bitmask). Defaults are the full sets, so every existing,
escalated and seeded row reads "no restriction" with nothing back-filled.
Additive: the running code tolerates the columns; new code against an
un-migrated database would 500, so production migrates **before** the deploy.

## 3. API — `listings.dto.ts`

- `pickupDays`, `pickupPeriods`, `dropoffDays`, `dropoffPeriods` on
  `baseListingSchema`, each **`.optional()`** (absent → column default). Not
  `.default()`: `CreateListingInput` is the parsed type, and a defaulted field
  would become required on the escalation literal.
- Days: `z.array(z.number().int().min(1).max(7)).min(1).max(7)`, duplicates
  refused, output sorted. Periods: `z.array(z.enum(TIME_SLOTS)).min(1).max(3)`,
  duplicates refused, output in `TIME_SLOTS` order.
- `createListingSchema`: a **restricted** set (not the full one) with
  `isFlexible: false` is refused, `AVAILABILITY_REQUIRES_FLEXIBLE` at that
  field. Whether a range contains an allowed weekday needs the requester's
  local calendar, which the DTO does not have; the form checks it (§4).
- `MATERIAL_FIELDS` gains the four — and `isFlexible`, which was missing: a
  carrier prices against both, so editing either expires live offers.
- `toInsert` writes the four; `flattenUpdate` already passes them through.
- `Job` (`src/features/app/listing/types.ts`) gains the four as **optional**:
  `messages.dal.ts` and `thread-offers.service.ts` project jobs without them,
  and an absent set reads as unrestricted everywhere.

## 4. Deriving the window — `timing.ts`

The schema still validates four instants; the form derives them.

**Exact mode** is unchanged: date + hour, a one-hour window; full sets.

**Flexible mode**, per end:

1. *Allowed days* = every local day from `date` to `dateUntil` whose
   `isoWeekday` is in `days`. None → the window is the raw range and
   `noAllowedDay` is raised (below).
2. *Intervals* = for each allowed day, the chosen periods merged where they
   touch (morning + afternoon = 06–18), in order.
3. `until` = the end of the last interval.
4. `from` = the start of the first interval that ends after a *not-before*
   moment, or that moment itself when it falls inside the interval:
   - pickup: `firstUsablePickup(now)` = `now + 30 min + 5 min`, rounded **up**
     to the half hour — 30 minutes being `MIN_BIDDING_WINDOW_MS`
     (`publication_timing_spec.md` §1–§3.2);
   - delivery: the derived pickup `from` — a delivery cannot start before the
     pickup does.
5. No interval ends after the not-before moment → the unclamped first start is
   kept, so the publication check (`pickupInPast`) or the schema's
   `deliveryBeforePickup` reports it rather than a window being invented.

So "Du 02/10 au 03/10, Matin" at 02/10 13:47 is 03/10 06:00 → 12:00: the
morning of the 2nd has passed. "Du 02/10 au 03/10, N'importe quand" is
02/10 14:30 → 03/10 22:00. Local `Date` constructors throughout — never a fixed
UTC offset, which would be an hour wrong across 25/10.

`resolveTimingWindows(timing, now)` returns the four instants, `isFlexible`,
the four sets (full in exact mode) and `pickupClampedFrom` (the derived start
when it is later than the range's own first slot, for the hint in §5).

**The weekdays stored are the ticked days the range can hold.** A day outside
« Du »…« Au » is disabled on screen and keeps its tick only so that widening
the range brings it back; it says nothing about when anyone is there, so it is
dropped before it can reach a carrier. All reachable days ticked is stored as
the full set (no restriction, no line); none ticked is kept as typed for
`noAllowedDay`.

**`noAllowedDay`** (`create.validation.noAllowedDay`, at `pickupDays` /
`dropoffDays`): a flexible end whose `from`…`until` local days contain none of
its `days`. In the schema, so it blocks « Suivant », « Publier » and the draft
alike — it is a contradiction in what was typed, not a question of time.

## 5. The form — `TimingField.tsx`

Flexible mode, for each of « Enlèvement » and « Livraison », in this order:

1. « Du » / « Au » (unchanged).
2. **« Jours possibles »** — seven checkboxes in one row, Lun … Dim, all
   **checked** by default; wraps on a narrow screen. A day that does not occur
   between « Du » and « Au » is disabled and dimmed but keeps its tick, so
   widening the range brings back what was chosen; while any day is disabled
   the hint « Les jours grisés ne tombent pas entre vos dates. » shows.
3. **« Moments de la journée possibles »** — four toggles, several may be on:

   | State | Shown pressed | Pressing… gives |
   |---|---|---|
   | all three (default) | « N'importe quand » | a period → only that period |
   | some | those periods | another period → added; a pressed one → removed (none left → all three); « N'importe quand » → all three |

   Ticking the third period lands back on « N'importe quand ». Below `sm`
   the four sit two by two as separate pills — a quarter of a phone's width is
   narrower than « N'importe » — and join into one segmented bar from `sm` up.
4. Pickup only: the hint `create.when.clampedFrom` « Les créneaux déjà passés ne
   comptent pas : l'enlèvement commencera au plus tôt le {from}. » when
   `pickupClampedFrom` is set.

Exact mode keeps one date, one time of day, one hour.

## 6. Where it is read back

One line, only when a set is restricted (`describeAvailability`, pure):
days as their short names, runs of three or more joined (« Lun–Ven »), then
periods (« Matin, Soir »), separated by « · ». Labels reuse
`create.when.weekdays.*` and `create.when.slot.*`, as `JobDetail` already reuses
`create.locationTypes`.

| Surface | Where |
|---|---|
| `RequestSummary` (`/home`, `/listings/me`, the thank-you page) | under each window |
| `JobDetail` → `Endpoint` (requester, carriers, admin) | under each window |
| `SubmitOfferForm` | above the slot picker: « Préférence du client pour l'enlèvement : … » |

## 7. Not in this release

- **No enforcement.** A flexible job already accepts offers outside its window
  (`offers.service.ts`, `offer-slots.ts`); refusing an offer for a weekday or a
  period would break the copy's promise that carriers may propose outside it.
- The board's day filter, carrier-route matching and route alerts still read
  only the outer window. Matching on weekdays needs the listing's timezone.
- The board card (`JobCard`), the opening chat line, emails, admin tables and
  the Expedion bridge are unchanged; escalated jobs take the defaults.

## 8. Test coverage required

- `src/features/app/create/__tests__/timing.test.ts`: exact mode unchanged;
  flexible "any" = 06:00 → 22:00; several periods give the earliest start and
  latest end; unticked weekdays move both ends; today's passed slots are
  skipped and an in-progress one starts at the half-hour after now + 35 min;
  delivery never starts before pickup; no allowed day keeps the raw range;
  exact mode returns full sets.
- `src/lib/__tests__/listing-availability.test.ts`: `describeAvailability`
  (full → null, runs, Sunday not joined to Monday, periods order).
- `src/features/app/create/__tests__/TimingField.test.tsx`: seven checked
  boxes per end in flexible mode, out-of-range days disabled, the period toggle
  table above.
- `src/features/app/create/__tests__/schemas.test.ts`: `noAllowedDay`.
- `src/server/dto/__tests__` (listings DTO): duplicates refused, order
  normalised, `AVAILABILITY_REQUIRES_FLEXIBLE`, absent accepted.
- `listings.service.test.ts`: the four sets reach the insert.
- `src/features/app/create/__tests__/jobs.api.test.ts`: the payload carries the
  four sets.
- `RequestSummary.test.tsx`: the line appears when restricted, not otherwise.
- `src/db/__tests__/migrations-journal.test.ts` passes with `0035`.

## 9. « N'importe quand » on an exact day (2.91.0)

Client feedback, 2026-11-19: « Date précise » offered Matin / Après-midi / Soir
and an hour, and no way to say "that day, whenever". The flexible mode had the
choice; the exact one did not.

- **The choice.** In « Date précise », each end's « Moment de la journée » is
  « N'importe quand · Matin · Après-midi · Soir » (`EndpointTiming.slot` is an
  `ExactSlot`: a time of day or `"any"`). While « N'importe quand » is chosen
  the « Heure précise » select is not shown; the hour last chosen is kept out
  of sight and comes back with a time of day's own default. The optional
  « Plage horaire précise » under it is unchanged and still says the hours when
  the requester has them.
- **The window** (`resolveWholeDay`, `timing.ts`). That day from 06:00 to
  22:00 — exactly what one flexible day with every time of day resolves to
  (§4). **`isFlexible` stays `false`**: the day is fixed, the hour is the
  carrier's to propose. The four availability sets are the full sets, as for
  any exact request.
- **Today.** Like a flexible start, a whole day never begins before the first
  usable pickup (`firstUsablePickup`) while part of the day is still ahead of
  it: chosen at ten, today's window is 10:30-ish → 22:00, and the hint under
  « Enlèvement » says so (`pickupClampedFrom`, the copy flexible already uses).
  A day already over is kept as typed for the publication check to report. A
  whole-day delivery never starts before the pickup does. An exact **hour** is
  still posted as chosen, never moved.
- **Round trip** (`from-listing.ts`, `isWholeDay`). A non-flexible window that
  closes at 22:00 on the day it opens and is wider than the one hour an exact
  time gets comes back as « N'importe quand », with no « time moved » notice —
  on a draft resumed, a live request unpublished to be edited, and a copy
  posted again. 21:00–22:00 is the evening's last hour, not a whole day. A
  window from before the one-hour rule that happens to end at 22:00 (10:00–
  22:00) reads as a whole day too, which widens it to 06:00; one that ends
  anywhere else (09:00–17:00) is still narrowed to its first hour and named
  (`draft_requests_spec.md` §2).

### 9.1 What follows from a wider non-flexible window

- **Offers.** `submitOffer` refuses, whole, an offer with a slot that does not
  overlap a non-flexible window (`PICKUP_OUTSIDE_WINDOW`). Against a whole day
  all three periods of that day overlap, and no slot of any other day does —
  which is the request: that day, any time. `offerablePeriods` asks the same
  question per period and copes without change (it returns all three for the
  day, none for its neighbours; on the day itself, a period already over is
  still dropped by its own `end <= now` test).
- **Publication.** `publication.ts` judges `pickupFrom`, here 06:00 (or the
  clamped start today). Nothing new is refused or allowed.
- **Bidding deadline — unchanged, and worth knowing.** `biddingRunsUntil`
  (`src/lib/listing-window.ts`) lets only a *flexible* direct request run to
  the end of its window; an exact one closes six hours before its start. A
  whole day tomorrow therefore stops taking offers at midnight tonight, and a
  whole day chosen for *today* gets the thirty-minute minimum, although its
  window is open until 22:00. The form's « bidding closes soon » warning says
  so. Letting a whole-day exact request run along its window is a change to
  `listing-window.ts` and to what `takeJob`/`assignDirect` book, not to the
  form.
- **Display.** `RequestSummary` and the job page print the window as a range,
  « 20 nov. 06:00 – 22:00 »; no availability line is added, since the sets are
  full.

### 9.2 Tests

- `timing.test.ts`: the whole day equals one flexible day; `isFlexible` false;
  the leftover hour ignored; today clamped and hinted; a day over kept as
  typed; a same-day delivery not before its pickup; mixed with an exact hour;
  `offerablePeriods` against the resolved window.
- `from-listing.test.ts`: the round trip posts the same window; told apart end
  by end; a clamped same-day start; 21:00–22:00 not a whole day; a flexible day
  not taken for it.
- `TimingField.test.tsx`: the fourth choice at both ends; the hour hidden and
  brought back; the optional hours still offered.
