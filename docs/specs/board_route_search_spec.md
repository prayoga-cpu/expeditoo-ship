# Job board route search — spec

Status: implemented.
Supersedes limitation §10.1 of `carrier_trips_spec.md`.

## 1. What this is

The job board (`/expedion`) gained the search a driver actually reasons with:
**a departure city, an arrival city, and the days they can drive.**

Until now the board offered a full-text box, three numeric filters and a sort.
Geography existed in the query schema but had no control anywhere in the UI, and
the board never read its own URL — so `routeMatchHref`, the "voir les courses
correspondantes" link on a trip card, produced a URL the board silently ignored.
Both are fixed here.

Three filters are added, in the client's words:

| Ask | Delivered as |
|---|---|
| "Search bar to enter departure city and arrival city" | Two city fields at the top of the board |
| "*Autour de* / *Sur mon trajet*" | A two-way mode toggle over those fields |
| "which days within that range they're available, and at what time of day" | A multi-day calendar plus morning/afternoon/evening slots |

## 2. Query parameters

`browseListingsQuerySchema` gains four coordinates and three availability
parameters. **`nearLat`/`nearLng` are renamed `fromLat`/`fromLng`** — the point
is now one end of a possible corridor, not an isolated centre, and this repo
takes renames rather than aliases (CLAUDE.md gotcha 6).

| Parameter | Type | Meaning |
|---|---|---|
| `fromLat`, `fromLng` | number | Where the driver starts |
| `toLat`, `toLng` | number | Where the driver is going. Absent in *Autour de* |
| `via` | `lat,lng` pairs joined by `;`, ≤ 3 | The étapes between them, in order. A comma already separates one pair's halves, hence the semicolon |
| `radiusKm` | number, ≤ 1000 | Radius around the point, **or** half-width of the corridor |
| `days` | `YYYY-MM-DD,…`, ≤ 31 entries | The days the driver is available |
| `slots` | `morning,afternoon,evening` | Time of day, applied to every selected day |
| `tzOffset` | integer minutes | The client's `getTimezoneOffset()`, so a slot means the same hour to the driver as to the database |

**The mode is derived, never declared.** `toLat` + `toLng` present means
corridor; otherwise the point and radius mean radius. Étapes ride on the
arrival: waypoints with nowhere to route describe no path and are dropped, and a
half-added étape — a blank row the driver has not filled in — filters nothing
rather than sending its placeholder coordinates. There is no `mode`
parameter, so there is no state where the two disagree. The UI toggle is UI
only: switching to *Autour de* drops the arrival coordinates, and a *Sur mon
trajet* search with the arrival field still empty degrades to a radius search
rather than erroring. An arrival with no departure describes no corridor and no
circle, so it filters nothing — the URL parser drops it, and the DAL requires a
departure before either predicate applies.

## 3. Autour de — radius

Unchanged in meaning from the pre-existing `nearLat`/`nearLng` filter: a job
matches when its **pickup** point is within `radiusKm` of the given point.

Deliberately the pickup only, not either endpoint. A driver asking for work
"around Lyon" wants loads to *collect* near Lyon; a Paris → Lyon job is not work
near Lyon for them, it is work near Paris. Matching either endpoint would fill
the board with jobs whose collection is 500 km away.

## 4. Sur mon trajet — corridor

A trajet is a **path**, not a segment: départ, up to three étapes, arrivée
(`MAX_PATH_POINTS` = 5). A plain two-city search is the one-leg case and needs
no special handling.

A job is on the way when all three hold:

1. its pickup lies within `radiusKm` of the **nearest leg**;
2. its dropoff lies within `radiusKm` of its own nearest leg;
3. the pickup is **no further along the whole path** than the dropoff.

Rule 3 is what makes it a *trajet* rather than a bounding box: a driver running
Bordeaux → Paris is offered Angoulême → Orléans and never Orléans → Angoulême.
With étapes the same rule reads along the whole path, so a load may not double
back through one either.

Because progress is measured along the path rather than within a leg, the
nearest leg has to be identified before progress can be read — an argmin, not a
minimum. Adding Lyon between Bordeaux and Paris reaches jobs the straight
corridor cannot, and drops ones it could.

### 4.1 The maths

Coordinates are projected to a local planar frame in kilometres, scaled at the
corridor's mid latitude:

```
x = lng · cos(latMid) · 111.32      y = lat · 111.32
```

For a leg A→B and a point P, with `t` clamped to [0, 1]:

```
t        = clamp( ((P−A)·(B−A)) / |B−A|² , 0, 1 )
detour   = | P − (A + t(B−A)) |
progress = startKm + t · lengthKm      // distance along the whole path
```

`detour` answers rules 1 and 2; `progress` answers rule 3. Across a path,
`detour` is the least over the legs and `progress` is the one belonging to that
same leg.

Equirectangular projection over a segment shorter than metropolitan France errs
by well under a percent — the same trade `distanceKmSql` already makes, and the
same answer applies: PostGIS is the move if this ever needs to be exact.

**Degenerate leg.** When a leg's two ends are the same place,
`|B−A|² = 0` and `t` is undefined. The DAL falls back to plain distance from the
departure point, which is the limit of point-to-segment distance as B→A — so
this is the correct answer rather than a guard, and a driver who types one city
into both fields gets a radius search instead of a 500.

### 4.2 One formula, two languages

`src/lib/route-corridor.ts` holds the reference implementation and carries the
unit tests. `listings.dal.ts` transcribes the same expression into SQL, built
from the path the TypeScript computes. The projection, the mean-latitude scaling
and the clamp therefore exist once; only the point-to-segment expression is
written twice, and both copies name the other in a comment.

The argmin is a correlated subquery over the legs (`select … union all … order
by d limit 1`), which is one term per leg. Spelled as a nested `CASE` it would
repeat the detour expression once per leg *per leg*.

## 5. Availability — days and time of day

`days` × `slots` expands to a set of concrete intervals; a job matches when its
pickup window `[pickupFrom, pickupUntil]` **overlaps at least one** of them.

| Slot | Local hours |
|---|---|
| `morning` | 06:00 – 12:00 |
| `afternoon` | 12:00 – 18:00 |
| `evening` | 18:00 – 22:00 |

Overlap, not containment: a job open 26 August → 9 September is offered to a
driver free only on 2 September, which is the whole point of the client's note
that a fortnight-wide range is not precise enough to act on.

Adjacent slots on the same day are merged before the query is built, so
`morning + afternoon` becomes one 06:00–18:00 interval rather than two. All
three slots on one day collapse to a single 06:00–22:00 interval. With `days`
capped at 31 the worst case is 62 intervals in the `OR`.

Selecting days without slots means the whole of those days (00:00–24:00).
Selecting slots without days filters nothing — a time of day with no date is not
a constraint — and the UI disables the slot row until a day is picked.

### 5.1 Timezone

`tzOffset` is the client's `Date.prototype.getTimezoneOffset()`. The server adds
it back to build UTC instants, so "morning" is the driver's morning and not the
server's. Production runs `TZ=UTC` and would otherwise place a French driver's
06:00 at 08:00.

A single offset is sent for the whole selection, so a range straddling a DST
change is one hour out on the far side of it. That is two days a year, one hour,
on a search filter; the alternative is 93 explicit instants in the URL.

## 6. The board reads its URL

`useJobBoard` now seeds its filter state from `useSearchParams()` and writes
committed filters back with `router.replace(..., { scroll: false })`. The search
box writes its debounced value, not every keystroke.

Consequences:

- `routeMatchHref` works. A trip card's "voir les courses correspondantes" lands
  on a board that is actually filtered.
- A search is shareable and survives a reload.
- Because `routeMatchQuery` now emits both endpoints, a declared trip searches
  its **corridor** — limitation §10.1 of `carrier_trips_spec.md` is closed.

`page` is not in the URL: it resets to 1 on every filter change, and a shared
link should open at the first page of the search rather than the middle.

## 7. Screen behaviour

Above the existing search box:

- A `ToggleGroup` of two: **Autour de** / **Sur mon trajet**.
- **Autour de**: one city field and a radius select (25 / 50 / 100 / 200 km).
- **Sur mon trajet**: departure and arrival city fields with a swap button
  between them, and the same radius select relabelled as detour tolerance.
- A single availability trigger opening a popover: a two-month multi-select
  calendar and a three-way slot toggle group.

City fields are `CityField` — Nominatim search over `searchAddress`, restricted
to France, resolving to a name plus coordinates. Typing without choosing a
suggestion filters nothing; only a chosen place carries coordinates.

The active-filter badge counts location and availability alongside the numeric
filters. Clearing filters clears the URL too.

## 8. The map

The board is a list **and** a map, as Cocolis is: the pins are the rows, placed.

- One pin per job, at its **pickup** point — the place a driver has to
  physically reach before anything else about the job matters. Not the midpoint,
  which is nowhere.
- A pin carries the two things that decide whether it is worth a click: the
  price and the size badge.
- Hovering either half highlights the other, so a card and its pin read as one.
  Clicking a pin opens the job.
- When the driver has named a trajet, the path is drawn under the pins — étapes
  and all — so *sur mon trajet* is something they can see rather than infer from
  a list that got shorter.
- The view refits whenever the answer changes. `fitBounds` frames the *points*,
  but a pin is a pill centred on its point, so the padding covers the label's
  overhang; without it the outermost price is clipped, and that is precisely the
  price a driver at that end of the trajet is looking for.
- Tiles come from `getMapStyle()`, the source `LocationPickerField` already
  renders, so the board inherits the light and dark cuts.

**Layout.** Desktop puts the list and the map side by side, the list scrolling
and the map fixed. A phone has room for one, so it gets a *Liste* / *Carte*
switch — placed **above** both, never inside the half it hides, and choosing
*Carte* scrolls the map into view rather than leaving the driver looking at the
filters they just used.

The map needs a **definite** height, not a minimum: it fills its box with
`height: 100%`, and a percentage against a parent that only has a `min-height`
resolves to zero.

## 9. The card

A commune name alone is unreadable — France has ~35,000 of them. The card
therefore says, for each end:

```
○ Riom (63200)
  à 13 km de Clermont-Ferrand
```

- **Postcode** disambiguates the ~1,400 commune names France reuses.
- **"à X km de <ville>"** places it against a city the driver knows, from the
  forty-row table in `src/lib/french-cities.ts` — a static list because it is
  forty rows that never change inside a release, and a geocode per card on a
  twenty-row board would be absurd. Dropped when the commune *is* the landmark
  ("Lyon, à 2 km de Lyon" is noise) or when nothing well known is inside 60 km.
- **The full window**, "Entre le 2 sept. et le 16 sept.", collapsing to "Le 2
  sept." for a single day. The board previously printed `pickupFrom` alone,
  which said "2 Sep" for a job collectable across a fortnight — the
  precise-looking half of a vague answer, and the thing the client asked to fix.
- **Size badge**, S…XXXL, from `cargoSizeLabel`: the smallest `/create` preset
  whose every dimension still contains the load, compared longest side to
  longest side so a plank on its end is the same load. `xxxl` is a badge rather
  than a preset because nothing offers it as an input. No dimensions, no badge —
  never a guess.
- **URGENT** where the board already knew bidding closes within six hours.

## 10. Non-goals

- No per-day slot overrides. Slots apply to every selected day. The wire format
  is already per-day capable if that changes.
- No road distance. The corridor is straight lines between the stops, not an
  OSRM route, so a job across an estuary can read as on-corridor when the drive
  is not. The same caveat applies to "à X km de": it is as the crow flies, which
  is why the reference says 13 km where a road atlas says 12.
- No clustering. Twenty pins is the page size, and twenty pins do not need it.
- Availability filters the **pickup** window only. Dropoff windows are not
  matched.

## 11. Test coverage required

- [x] Projection: a point on the segment has detour ≈ 0
- [x] A point perpendicular to the segment measures its true offset
- [x] Direction: a reversed job is rejected, the forward one kept
- [x] Degenerate segment falls back to distance from the departure point
- [x] Clamping: a point beyond the arrival measures from the arrival
- [x] Slot intervals honour a negative `tzOffset` (Paris summer)
- [x] Adjacent slots merge; all three collapse to one interval
- [x] Days with no slots cover the whole day
- [x] More than 31 days is rejected by the schema
- [x] `routeMatchQuery` emits both endpoints for a route with a destination
- [x] The board seeds its filters from the URL and writes them back
- [x] A path adds up its legs, and reports progress along the whole path
- [x] An étape reaches a job the straight corridor cannot
- [x] A load doubling back through an étape is still refused
- [x] The nearest leg decides, not the first
- [x] Étapes round-trip through the URL, in order, and are dropped without an
      arrival
- [x] More than three étapes is rejected by the schema
- [x] `cargoSizeLabel` is orientation-independent, and silent without dimensions
- [x] `nearestReferenceCity` says nothing when the place is the reference
