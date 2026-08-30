# Plan — job board route search

Spec: `docs/specs/board_route_search_spec.md`.
Client ask: search by departure and arrival city, *Autour de* / *Sur mon
trajet*, and precise availability days plus time of day.

## Order of work

1. **Pure maths, tested first.**
   - `src/lib/route-corridor.ts` — projection frame, point-to-segment detour and
     progress. No imports.
   - `src/lib/availability-window.ts` — days × slots → merged UTC intervals.
2. **Query boundary.** `browseListingsQuerySchema`: rename `nearLat`/`nearLng`
   to `fromLat`/`fromLng`, add `toLat`/`toLng`, `days`, `slots`, `tzOffset`.
3. **DAL.** `listings.dal.ts`: corridor predicate transcribed from the frame,
   availability `OR`, `distance_asc` ordering by detour in corridor mode.
4. **Client API + types.** `BrowseParams`, `JobFilters`, defaults.
5. **URL sync.** `useJobBoard` seeds from `useSearchParams`, writes back with
   `router.replace`. This is what makes the trip-card deep link work.
6. **UI.** `CityField`, `RouteSearchBar`, `AvailabilityField`, wired into
   `JobBoard`.
7. **Close the trips limitation.** `routeMatchQuery` emits both endpoints;
   update `carrier_trips_spec.md` §7 and §10.
8. **i18n.** FR and EN, exact parity.
9. **Gates.** `npx tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Dependencies

Step 3 depends on 1 and 2. Steps 4–6 depend on 2. Step 7 depends on 2. Nothing
here needs a migration: the corridor reads `pickup_*` and `dropoff_*` columns
that already exist, and availability reads the pickup window.

## Deliberate non-changes

- No new index. `dropoff_lat`/`dropoff_lng` gain no btree index because the
  corridor predicate is a computed expression that no btree index would serve —
  the same reason `listing_pickup_geo_idx` does not accelerate `distanceKmSql`
  today. Revisit with PostGIS, not with another index.
- Listing-side date precision is **not** touched. A job still carries one
  contiguous pickup window. If the client meant that the *poster* should name
  precise days and times, that is a separate change to `createListingSchema`,
  the `WhenStep` form and the escalation service.
