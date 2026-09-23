# Plan: carrier route match alerts

## Goal

Wire `carrier_routes.notify_on_match`, persisted since `0010_carrier_routes`
and explicitly called out as dead in two specs
(`carrier_trips_spec.md` §9: "persisted and read by nothing yet";
`carriers_on_route_spec.md` §8: "`notify_on_match` and its cron stay
unbuilt"). When a listing reaches the board, every carrier who declared a
trajet covering it and switched the toggle on gets an in-app notification.

No new matching engine: `matchRoute` (`src/lib/route-match.ts`) is the exact
predicate `carrier-discovery.service.ts` already runs the other way — same
corridor test, same calendar test, read from the alerting side instead of the
discovery side.

## Steps

1. **Migration** `0029_carrier_route_notify_index.sql` — index
   `(notify_on_match, is_active)`, mirroring the `is_discoverable` index added
   in `0020`. No new column: `notify_on_match` has existed since `0010`.
2. **DAL** (`src/server/dal/carrier-routes.dal.ts`) — extract the conditions
   `matchCandidateWhere` shares with a new consent path into
   `sharedCandidateConditions`, and add `findNotifyCandidates`, identical to
   `findMatchCandidates` except it gates on `notify_on_match` instead of
   `is_discoverable`. The two flags are independent by design (schema
   comment, `carrier-routes.ts` lines 95–101): a private trajet can still ask
   for alerts.
3. **Service** `src/server/services/carrier-route-alerts.service.ts` —
   `notifyMatchingCarriers(listing)`: builds the same `MatchTarget` shape
   `carrier-discovery.service.ts` does, reads notify-candidates, runs
   `matchRoute`, drops the listing's own shipper (self-match), dedupes to one
   notification per carrier (a carrier may hold several matching trajets),
   and fires `notificationsService.createNotification` per carrier —
   best-effort, one failure never blocks another.
4. **Hook points**:
   - `listings.service.ts` `createListing` — gains an optional third
     parameter `{ notifyRouteMatches?: boolean }` (default true) and fires
     the alert whenever the listing is immediately open (`publish &&
     !scheduledPublishAt`).
   - `listings.service.ts` `publishScheduled` — fires the same alert once a
     due scheduled listing flips to `open`.
   - `expedion-escalation.service.ts` `escalate` — passes
     `{ notifyRouteMatches: !opts.directAssignment }` on its `createListing`
     call. **Why not unconditional**: `assignDirect` calls `escalate` and then
     awards a pre-chosen driver in the same synchronous flow (`submitOffer` +
     `acceptOffer`, no await gap) — the listing is open for milliseconds
     before it is spoken for. The code already gates the client SMS the same
     way at line 359 ("the listing is open... `writeBack` texts the client...
     moments later"); this follows the same precedent rather than inventing a
     second one.
5. **UI copy** — `/carrier/trips`' notify switch hint currently reads
   "Coming soon — the preference is saved now." / "Bientôt disponible..."
   (`messages/{en,fr}.json`, keys `carrier.trips.form.notifyHint`). Update
   both to state the alert now fires.
6. **Spec updates** — strike the two "unbuilt" callouts in
   `carrier_trips_spec.md` §9/§10 and `carriers_on_route_spec.md` §8, each
   with a dated note and a pointer to the new spec, matching this repo's
   convention for reversed statements (see `carrier_trips_spec.md` §9's own
   struck-through bullet about discoverability).
7. **Tests** — DAL (`findNotifyCandidates` respects `notify_on_match` and
   ignores `is_discoverable`), service (self-match excluded, dedup, best-effort
   on notification failure), and the two escalation-path gates
   (`directAssignment` suppresses the alert, normal escalation does not).

## Non-goals

- No email channel, no new toggle on the Settings page — confirmed with the
  user: in-app only, and the existing `/carrier/trips` switch is the one
  surface (no reconciliation of the separate, already-inconsistent email
  preference plumbing in `src/features/app/profile/`).
- No standalone "near my current location" concept independent of a declared
  trajet — "near the carrier" is answered by the trajet's own `radius_km`
  (confirmed with the user).
