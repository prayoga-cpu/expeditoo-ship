# Specification: Transporteurs disponibles sur le trajet

**Plan:** `docs/plans/plan_carriers_on_route.md`
**Related:** `docs/specs/carrier_trips_spec.md`, `docs/specs/board_route_search_spec.md`,
`docs/specs/chat_spec.md`, `docs/specs/thread_offer_spec.md`
**Date:** 2026-09-05

---

## 1. Overview

A requester who has posted a transport job waits for offers. The board already
lets a **carrier** find jobs on their trajet; nothing lets a **requester** see
the carriers whose trajet covers their job, and nothing lets them start the
conversation.

This spec adds one tab to `/listing/[id]`:

```
[ Détails ]   [ Transporteurs disponibles (14) ]
```

listing the approved carriers whose declared trajet covers this job inside its
pickup window, each with a **Contacter** button that opens a message thread
about this job.

The tab is a **discovery** surface, not a second award path. It writes no offer,
moves no money, changes no status. The reverse auction remains the only route to
an award — and because the thread it opens is bound to the listing, a carrier
contacted here lands on the thread-offer lane and can bid from the bubble
(`thread_offer_spec.md` §3), so the tab feeds the auction rather than routing
around it.

## 2. User stories

- As a requester whose job has no offers yet, I see the carriers who already
  drive this trajet, so the wait is not silent.
- As a requester, I contact one of them in one tap and land in a thread about
  my job, with an opening message already written.
- As an operator on an escalated Expedion job, I do the same in the client's
  place, because nobody signs in as `EXPEDION_SYSTEM_USER_ID`.
- As a carrier, I decide whether my declared trajets make me findable this way,
  and I am told exactly what a requester sees before I decide.

---

## 3. What "available on the route" means

> A carrier is **available on the route** of a job when they hold an `approved`
> carrier record on a live account, and own at least one trajet that is
> `is_active`, `is_discoverable`, whose corridor contains the job's **pickup and
> dropoff — in that order along the trajet** — within that trajet's own
> `radius_km`, whose declared capacity admits the job's weight, and which has at
> least one upcoming run inside the job's pickup window.

Five components, each grounded in a column that already exists.

### 3.1 Geometry — the job inside the carrier's corridor

The path is built from the **carrier's** `origin → destination` and the
**job's** `pickup`/`dropoff` are tested against it, at that trajet's own
`radius_km`.

This direction is the load-bearing choice. The opposite test (route endpoints
inside the job's corridor) answers a different question whenever the trajet is
longer than the job, which is the common case: a Brest → Paris driver passing
through Vannes and Montrouge *is* on that job's route, but their endpoints are
nowhere near the job's line. It would also apply a platform-wide radius the
carrier never agreed to, where `radius_km` is the carrier's own declared
tolerance for a detour.

`radius_km` is the corridor half-width applied to **both** endpoints. This is
already how the board reads it (`listings.dal.ts`, `board_route_search_spec.md`
§4); the schema comment on `carrier_routes.radius_km` says "off the origin" and
is stale — this change corrects it.

The predicate is `isOnPath` from `src/lib/route-corridor.ts`, unchanged and
uncopied. **The corridor formula is not written a third time**
(`board_route_search_spec.md` §4.2): it exists once in TypeScript and once
transcribed into SQL, and this feature reuses the TypeScript one.

### 3.2 Direction

`isOnPath` already requires `progressKm(pickup) <= progressKm(dropoff)`. A
Bordeaux → Paris trajet matches an Angoulême → Orléans job and never the
reverse.

### 3.3 Time — the job's pickup window

`upcomingOccurrences(route, windowStart)` from
`src/lib/carrier-route-matching.ts`, where
`windowStart = max(startOfDay(now), startOfDay(listing.pickupFrom))`, filtered
to `<= listing.pickupUntil`. At least one run must survive.

The helper's `MAX_DEEP_LINK_DAYS` (8) and `DEEP_LINK_HORIZON_DAYS` (56) caps are
relative to the `now` argument, so passing `windowStart` makes them harmless
here: any run inside the window is among the first eight found from the window's
start. **The helper is not modified.**

`listings.isFlexible` does **not** widen the window. It means carriers may
*propose* times outside it; it is not a claim about who is nearby. Stated here so
it is not re-litigated.

### 3.4 Capacity

`capacity_kg IS NULL OR capacity_kg >= listing.weight_kg` — the same direction
`TakeJobPanel` already uses for vehicles. A trajet that declares no capacity is
not excluded.

### 3.5 Eligibility

`carriers.status = 'approved'` **and** `user.banned = false`. A suspended or
banned carrier is not shown and cannot be contacted.

**The viewer is never their own match.** A requester may also be an approved
carrier, and nothing stops them declaring a trajet along the job they posted.
The card would be absurd, but the contact path would be worse:
`messagesDAL.findConversation(u, u, listingId)` asks for a conversation the user
participates in *twice*, which any of their threads about this listing
satisfies — so contacting yourself would post the opening line into some other
carrier's thread. Candidates whose `carriers.user_id` is the acting user are
dropped before the predicate runs, which also makes `contact` answer
`MATCH_NOT_FOUND` for them.

### 3.6 Where each half runs

| Half | Where | Why |
|---|---|---|
| Cheap prefilter | SQL, in the DAL | Bounding boxes, capacity, flags, occasional-date existence. No trig, no `sqrt`. |
| The real predicate | TypeScript, in the service | `isOnPath` + `upcomingOccurrences`, reused not copied, and unit-testable. |

The prefilter is the necessary condition of the corridor test: a point within
`R` km of segment `(o,d)` lies inside `bbox(o,d)` padded by `R`. Padding is
`R / KM_PER_DEGREE` in latitude and `R / (KM_PER_DEGREE · cos(lat))` in
longitude, computed from the trajet's own `radius_km` column.

Every computed float reaching SQL is cast with the `real()` helper. Omitting it
is the documented cause of a production 500 on the board
(`listings.dal.ts` — "invalid input syntax for type integer").

### 3.7 Ranking, deduplication and caps

| Constant | Value | Meaning |
|---|---|---|
| `MAX_MATCH_CANDIDATES` | 500 | Rows the SQL prefilter may return. |
| `MAX_MATCHES` | 30 | Carriers returned to the client. |
| `MAX_RUNS_SHOWN` | 3 | Run dates shown per card. |

One carrier may hold several matching trajets. Results are grouped by
`carriers.id`, keeping the match with the **smallest `detourKm`**, then ordered
by `detourKm` ascending, tie-broken by `averageRating` descending. `total` is
the count of **distinct carriers**, and that is the number in the tab badge.

`detourKm` for a match is `max(detour(pickup), detour(dropoff))` — the worse of
the two ends, so a card cannot rank well on one endpoint alone.

---

## 4. Consent and disclosure

### 4.1 The reversal, stated

`carrier_trips_spec.md` §9 recorded, as a non-goal "so it is not re-litigated",
that a trip is not visible to anyone but its carrier. This feature reverses that
for consenting trajets only. §1, §5, §9 and §10 of that spec are amended in the
same change; leaving them would put the codebase in contradiction with itself in
six places.

More than a comment is at stake. Every trajet that exists today was declared
under a French dialog reading **« Vous seul le voyez »**. That promise is why
the migration backfills existing rows to `false`.

### 4.2 The flag

`carrier_routes.is_discoverable boolean NOT NULL DEFAULT true`.

- **New trajets default `true`** — a supply pool nobody opts into is a dead tab.
- **Existing rows are backfilled `false`** — they were declared under the old
  promise. The column shipped one commit after `carrier_routes` itself, so the
  cost of that honesty is near zero.
- The dialog copy is corrected in the same change, and a switch is added to
  `/carrier/trips` so the state is both settable and legible.

Neither existing flag is overloaded, and both were considered:

| Column | Means | Why not |
|---|---|---|
| `notify_on_match` | "alert **me** when a job appears" | An unshipped *notification* preference, labelled « Bientôt disponible » in the UI. Turning it into *publication* consent changes what a switch does behind the driver's back. |
| `is_active` | "pause this saved query" | A driver pausing their own board filter would silently vanish from the pool; a driver hiding from requesters would lose their filter. |

### 4.3 What a requester sees

The projection is exactly these nine fields, and adding a tenth is a spec change:

| Field | Source |
|---|---|
| `matchId` | `carrier_routes.id`, opaque to the client |
| `displayName` | `user.name` |
| `avatarUrl` | `user.image` |
| `rating` | `carriers.average_rating` |
| `reviewCount` | `carriers.total_ratings` |
| `originCity` | `carrier_routes.origin_city` |
| `destinationCity` | `carrier_routes.destination_city` |
| `nextRuns` | up to `MAX_RUNS_SHOWN` calendar days, `YYYY-MM-DD`, already clipped to the job's window |
| `detourKm` | rounded, for ordering and a "sur votre trajet" line |

**Never crosses the wire:** `origin_address`, `destination_address`, postal
codes, any latitude or longitude, `radius_km`, `capacity_kg`, `vehicle_id`, the
vehicle row (including `plate_number`), `carriers.id`, `carriers.siret`, and —
above all — **`user.id`**. A requester never receives a user id from this
surface; contact is by `matchId` (§6.2).

Cities rather than addresses follows the precedent
`transport_status_confirmation_spec.md` already set for the public confirmation
payload. Cities and dates *are* disclosed, because without them the card cannot
be checked by the person reading it and "font le trajet prochainement" is an
unverifiable claim. The carrier's switch hint says so in as many words. A
stricter mode — carrier identity only, no cities, no dates — is a two-field
deletion from the projection if the client prefers it.

---

## 5. The surface

### 5.1 Where

A two-tab strip on the existing `/listing/[id]`, tab held in `?tab=`, following
`MyRequestsScreen`. Not a new route: the job already has one URL and the bottom
nav is already suppressed on `/listing/*`.

| Tab | Value | Content |
|---|---|---|
| **Détails** | `details` (default) | Today's `JobDetail` body, unchanged in behaviour. |
| **Transporteurs disponibles** | `carriers` | The new panel, with a count badge when `total > 0`. |

`page.tsx` must wrap `<JobDetail>` in `<Suspense>`: the screen now reads
`useSearchParams`, which `tsc --noEmit` accepts and `next build` rejects. The
same trap is documented in `listings/me/page.tsx`.

### 5.2 Who sees the strip

```
owner = listing.shipperId === viewerId
staff = listing.origin === "expedion" && (operator || admin)
show  = (owner || staff) && listing.status === "open"
```

Anyone else sees today's page with no tabs at all — the strip is not rendered,
not merely disabled. `open` only: a `draft` takes no offers and is not on the
board, so "des transporteurs vous contacteront" would be false there.

The operator fork mirrors `offersService.acceptOffer` and `JobDetail`'s existing
`canAward`. Without it the tab would be invisible on escalated jobs, which is
the inlet the product is built around.

### 5.3 Panel states, in this order

`isError` → `isLoading` → empty → rows. The `isError` branch is mandatory and
must offer a retry: a query hook that renders nothing on failure is how the
withdrawals 500 stayed hidden (CLAUDE.md gotcha 9).

### 5.4 Translating `JobDetail`

`JobDetail.tsx` has zero `useTranslations` calls and is entirely hardcoded
English. A translated tab strip bolted onto an English page is worse than
either, and the strip forces the file into the i18n system regardless, so the
~25 strings are translated in the same change under `myJobs.detail.*`.

New keys go under `myJobs.*`. They do **not** go under `listing.*`, which still
holds v1 goods vocabulary (`price`, `condition`, `seller`, `buyNow`,
`addToCart`, `contactSeller`) that CLAUDE.md gotcha 1 forbids extending.

---

## 6. API

### 6.1 `GET /api/listings/[id]/carriers`

Session required. → `carrierDiscoveryService.listForListing(userId, listingId)`.

```jsonc
{ "success": true, "data": {
    "items": [ { "matchId": "…", "displayName": "Faissal B.", "avatarUrl": null,
                 "rating": 5, "reviewCount": 1, "originCity": "Vannes",
                 "destinationCity": "Montrouge",
                 "nextRuns": ["2026-09-08T00:00:00.000Z"], "detourKm": 3 } ],
    "total": 14 } }
```

### 6.2 `POST /api/listings/[id]/carriers/[matchId]/contact`

Session required, rate limited. → `carrierDiscoveryService.contact(...)` →
`{ "conversationId": "…" }`, 201.

**`matchId` is the authorization, not a lookup key.** The service re-runs the
match and refuses any `matchId` absent from the result, so the endpoint can only
ever reach a carrier who genuinely matches this job. It is not a carrier
directory and cannot be walked. The user id is resolved server-side, through
`carrier_routes.carrier_id → carriers.user_id`, and never crosses the wire.

> `offers.carrier_id` references **`user.id`** while `carrier_routes.carrier_id`
> references **`carriers.id`**. The bridge is `carriers.user_id`. Confusing the
> two is the single most likely bug in this feature.

Rate limit: **20 contacts per listing per hour**, via `rateLimit` from
`src/lib/rate-limit.ts`. A page of thirty buttons is a different threat model
from one delivery detail page.

### 6.3 Error codes

| Code | Status | When |
|---|---|---|
| `LISTING_NOT_FOUND` | 404 | No such listing. |
| `NOT_LISTING_OWNER` | 403 | Signed in, but neither owner nor an operator on an Expedion job. 403 rather than 404 because a listing is public — hiding its existence from someone who can read it on the board buys nothing. |
| `LISTING_NOT_OPEN` | 409 | Status is not `open`. |
| `MATCH_NOT_FOUND` | 404 | `matchId` is not in the current match set. |
| `CONTACT_RATE_LIMITED` | 429 | Over the cap. |
| `CONTACT_FAILED` | 500 | `sendMessage` returned no conversation id. Unreachable in practice — it exists because the return type admits `undefined`, and the repo's idiom for an unreachable invariant is a typed error rather than a cast. |

`CarrierDiscoveryError` **must** be registered in `handleError`'s `instanceof`
chain in `src/lib/api-response.ts`. Skipping that is exactly the `PaymentError`
bug that file already carries the post-mortem for: the error reaches the browser
as a bare 500 with no `code`, and the hook's error map can never fire.

### 6.4 The opening message

`contact` sends a first message through `messagesService.sendMessage(ownerId,
{ recipientId, listingId, content })` — **not** `POST /api/messages/init`.

`sendMessage` is chosen for what it avoids. `init` stamps `lastMessageAt` on a
message-less conversation, which `getUnreadCount` counts, so every tap would
raise a phantom unread badge on both sides; and `init` publishes nothing, so the
carrier would never learn they had been contacted. `sendMessage` does its own
find-or-create without that stamp and fans out on Ably.

Passing `listingId` is deliberate: it puts the thread on the job lane of
`threadOffersService.contextFor`, so the carrier gets the offer button and a
bubble offer mints a real `offers` row.

The body is templated from the listing and written in **French**, not in the
requester's browsing locale. It is the text of a message a carrier will read,
not a UI string: translating it into whatever language the sender happens to be
browsing in would hand a French driver an English opening line. That is why it
lives in the service rather than a catalogue. For example:

> Bonjour, je cherche un transporteur pour « {title} », {pickupCity} →
> {dropoffCity}, entre le {from} et le {until}. Seriez-vous disponible ?

---

## 7. Data model

`src/db/migrations/0020_carrier_route_discoverable.sql`, hand-written
(`pnpm db:generate` is unusable in this repo), registered in
`meta/_journal.json` as `idx: 19`, `when: 1788102000000` — strictly greater than
the newest entry already recorded, or the migrator skips it in silence. It was
drafted as `0019` and renumbered: `0019_invoice_documents` claimed that slot
first, and two migrations sharing a prefix is exactly what
`migrations-journal.test.ts` now fails on.

```sql
ALTER TABLE "carrier_routes"
  ADD COLUMN IF NOT EXISTS "is_discoverable" boolean DEFAULT true NOT NULL;
UPDATE "carrier_routes" SET "is_discoverable" = false;
CREATE INDEX IF NOT EXISTS "carrier_route_discoverable_idx"
  ON "carrier_routes" ("is_discoverable", "is_active");
```

The backfill is one-way and intentional (§4.2). **The deploy does not migrate** —
the Vercel build is a plain `next build` — so run *Actions → Migrate database*
**before** the deploy, or the tab 500s on a missing column.

---

## 8. Non-goals, stated so they are not re-litigated

- **No Particuliers / Professionnels filter.** The competitor screenshot has
  two checkboxes; this data cannot honestly fill them. Every carrier here passes
  KYC with a `NOT NULL` SIRET, and `fr.json` already tells users « Chaque
  transporteur qui enchérit sur ce réseau est un professionnel indépendant
  validé » — so "Particuliers" is an empty bucket. The only company signal,
  `legal_form`, is optional uncontrolled free text (`SASU`, `sasu`, `S.A.S.U`,
  `auto-entrepreneur` and `NULL` are all reachable), so the two boxes would not
  partition the set. If the distinction is wanted it needs a real
  `carrier_kind` enum, a control on the KYC form and a backfill — a separate
  change. Deriving it from `legal_form` or from `vat_number` presence is
  rejected outright.
- **No Messages tab.** The screenshot's third tab needs a per-listing thread
  list that does not exist — no endpoint, no DAL method, no unread count. A tab
  wired to nothing is worse than no tab.
- **No "Gérer mon annonce" tab.** `listingsApi.cancel` has no caller,
  `PATCH /api/listings/:id` has no client, and `publishListing` has no route, so
  the name would promise edit, cancel and publish where none is wired. The first
  tab is honestly called **Détails**.
- **No road distance.** Straight-line corridor only, no OSRM. `src/lib/routing.ts`
  hits a public demo server with no cache, timeout or rate limit, and
  `board_route_search_spec.md` §10 already rules road distance out for the board.
  A job across an estuary can read as on-corridor.
- **No waypoints.** A trajet is exactly two points; `via` is a board search input,
  never a stored field.
- **No time of day.** A trajet stores no time of day. Day granularity only, even
  though offers and the board speak `morning`/`afternoon`/`evening`. Runs cross
  the wire as `YYYY-MM-DD` for the same reason: `upcomingOccurrences` returns
  local midnight, and `toISOString()` on that names the previous day anywhere
  east of UTC — invisible on a `TZ=UTC` production box, immediate on a laptop.
- **No availability or price commitment.** A trajet is not an offer
  (`carrier_trips_spec.md` §9). Copy says *font le trajet prochainement*, never
  *disponible* in the sense of "will take this job".
- **No notification to the carrier beyond the message itself.** No `notifications`
  row, no email. `notify_on_match` and its cron stay unbuilt.
- **No writes.** `carrier-discovery.service.ts` may not write `offers`,
  `listings`, `shipment_events`, a payment or a status. Its only write is the
  message, and a test asserts it.

---

## 9. Known limitations

1. **The prefilter is not sargable.** No index can serve
   `least(origin_lat, destination_lat) - radius/111.32 <= :lat`. This is a
   sequential scan over `carrier_routes` with cheap arithmetic per row, bounded
   by `LIMIT 500`. `carrier_route_discoverable_idx` narrows the flag test and
   nothing more. PostGIS remains the future move, as `listings.dal.ts` already
   notes for the board.
2. **Equirectangular geometry**, scaled at the path's mean latitude — under a
   percent of error over metropolitan France, the same trade the board makes.
3. **`valid_from` / `valid_until` are unreachable from the UI.**
   `TripRouteFormDialog` has no control for them, so every trajet created
   through `/carrier/trips` has both `null` and a recurring trajet is
   open-ended. Tests that need a closed validity window must set the columns
   over the API.
4. **Recurring occurrence maths runs in the server's timezone**, as everywhere
   else in this repo; production runs `TZ=UTC`.
5. **The pool starts empty** because of the §4.2 backfill, and fills only as
   drivers opt in. This is a product fact to communicate, not a bug.

---

## 10. Test coverage required

**`src/lib/__tests__/route-match.test.ts`** — reusing the Bordeaux / Paris /
Lyon / Angoulême / Orléans / Toulouse fixtures from `route-corridor.test.ts`:

- a job on the corridor matches; one off it does not;
- a job travelling against the trajet does not match;
- a recurring trajet whose weekday falls inside the job's window matches, and
  one whose weekday falls outside does not;
- an occasional trajet with a stored date inside the window matches, outside
  does not;
- an expired `validUntil` and an empty `daysOfWeek` both yield no match;
- `detourKm` is the **worse** of the two endpoints.

**`src/server/services/__tests__/carrier-discovery.service.test.ts`:**

- a non-owner gets `NOT_LISTING_OWNER`; the owner of a direct job gets matches;
- an operator gets matches on an `expedion` job and `NOT_LISTING_OWNER` on a
  `direct` one;
- a `draft` / `awarded` / `cancelled` job yields `LISTING_NOT_OPEN`;
- paused (`is_active=false`), non-discoverable, non-approved and banned carriers
  are all excluded;
- two matching trajets from one carrier dedupe to one card, keeping the smaller
  `detourKm`, and `total` counts carriers not trajets;
- results are capped at `MAX_MATCHES`, and `total` keeps counting past the cap;
- a requester who is themselves a matching carrier is absent from their own
  cards, and `contact` on that `matchId` gives `MATCH_NOT_FOUND` with no message
  sent;
- runs are emitted as `YYYY-MM-DD`, not as instants;
- `contact` refuses a `matchId` absent from the match set with `MATCH_NOT_FOUND`;
- `contact` calls `sendMessage` with `listingId` set and a non-empty body;
- the service performs **no** write other than that message.

**`src/server/dto/__tests__/carrier-discovery.dto.test.ts`:**

- parsing a row rich in private columns yields exactly the nine fields of §4.3,
  and `userId`, `originAddress`, `destinationAddress`, postal codes, lat/lng,
  `radiusKm`, `capacityKg`, `vehicleId` and `plateNumber` are all absent.
  This is the test that keeps §4.3 true a year from now.

**`src/i18n/__tests__/locale-parity.test.ts`** — unchanged, must stay green.
**`src/db/__tests__/migrations-journal.test.ts`** — unchanged, picks up entry 18.
