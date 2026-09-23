# Carrier route match alerts

## 1. What this is

`carrier_routes.notify_on_match` has existed since `0010_carrier_routes`: a
carrier declaring a trajet on `/carrier/trips` can switch on "M'alerter des
courses correspondantes". It has never done anything —
`carrier_trips_spec.md` §9 and `carriers_on_route_spec.md` §8 both say so
plainly. This wires it: when a listing reaches the board, every carrier whose
active, `notify_on_match` trajet covers it gets one in-app notification.

This is **not** a new matching engine. `matchRoute` (`src/lib/route-match.ts`)
is the same predicate `carrier-discovery.service.ts` runs for "Transporteurs
disponibles" — same corridor test (`isOnPath`), same calendar test
(`upcomingOccurrences`) — read from the alerting side instead of the discovery
side. A listing that matches a trajet can produce the discovery card, this
alert, both, or neither, from one answer to one question.

## 2. Two independent consents

| Column | Means | Read by |
|---|---|---|
| `is_discoverable` | "let a requester find and message me" | `carrier-discovery.service.ts` (unchanged) |
| `notify_on_match` | "alert me when a job appears" | `carrier-route-alerts.service.ts` (new) |

A trajet kept private (`is_discoverable = false`) can still fire an alert —
the carrier is not asking to be found, only to hear about jobs on their own
declared route. Neither flag stands in for the other
(`carrier-routes.ts` lines 95–101).

## 3. Where it fires

A listing is genuinely open to any carrier at exactly two moments, and the
alert fires at both:

1. `listingsService.createListing` — a direct `/create` post published
   immediately, or an Expedion quote's normal (non-direct-assignment)
   escalation.
2. `listingsService.publishScheduled` — a direct listing's scheduled publish
   instant arrives (cron: `publish-scheduled-listings`).

It does **not** fire from `expedionEscalationService.assignDirect`. That path
calls `escalate` and then, in the same synchronous call with no await gap,
awards a pre-chosen driver (`submitOffer` + `acceptOffer`) — the listing is
open for milliseconds before it is spoken for. The code already treats this
moment as not-really-public: the client SMS that would otherwise say "your job
went to tender" is suppressed for exactly this case
(`expedion-escalation.service.ts`, `if (!opts.directAssignment)`). The alert
follows the same gate rather than inventing a second rule for the same fact.

`createListing` therefore takes an optional third argument,
`{ notifyRouteMatches?: boolean }`, default `true`. `escalate` passes
`{ notifyRouteMatches: !opts.directAssignment }`; the plain `/create` route
never passes it and gets the default.

## 4. The predicate

Unchanged from `route-match.ts`. For a listing:

```
job = {
  pickup: listing.pickupLat/Lng,
  dropoff: listing.dropoffLat/Lng,
  pickupFrom, pickupUntil,
  weightKg,
}
```

A trajet matches when, in order: its `capacity_kg` (if set) covers the job's
`weight_kg`; both the pickup and dropoff sit within `radius_km` of the
trajet's origin→destination segment, travelling the trajet's own direction
(`isOnPath`); and at least one of its runs (`upcomingOccurrences`) falls
between `max(now, listing.pickupFrom)` and `listing.pickupUntil`.

## 5. Candidate prefilter

`carrierRoutesDal.findNotifyCandidates` mirrors `findMatchCandidates`
(bounding box, capacity, recurring/stored-date check — see
`carriers_on_route_spec.md` §3.6 for why the box may only ever admit too much,
never too little) but swaps the consent condition:

```
and(
  eq(carrierRoutes.isActive, true),
  eq(carrierRoutes.notifyOnMatch, true),
  eq(carriers.status, "approved"),
  eq(user.banned, false),
  ...capacity, calendar, bounding-box conditions (shared, unchanged)
)
```

`is_discoverable` is not part of this WHERE — see §2.

## 6. Fan-out rules

- **One notification per carrier**, not per trajet. A carrier can declare
  several trajets that all cover one job; they hear about it once.
- **The listing's own shipper is excluded**, the same self-match guard
  `carrier-discovery.service.ts` applies — a requester who is also an
  approved carrier with a matching trajet does not get alerted about their
  own job.
- **Best-effort throughout.** The candidate lookup and every individual
  `createNotification` call are wrapped so a failure never blocks the listing
  publish or another carrier's notification — the same convention
  `sendListingPostedEmail` and `notifyOffersInvalidated` already follow.
- **In-app only.** No email channel. `notificationsService.createNotification`
  already fans out over Ably to the bell in real time; nothing further is
  added. Gated by the recipient's own `inApp.carrierRouteMatch` preference —
  see `notification_channel_settings_spec.md` §5.

## 7. Notification shape

```
type: "carrier_route_match"
title: "Une course correspond à votre trajet"
message: `"${listing.title}" : ${pickupCity} → ${dropoffCity}.`
linkUrl: /listing/{listingId}
data: { listingId, routeId }
```

`type` is a free string on this table (`notifications.type`, `text`, not an
enum — see `src/server/dto/notifications.dto.ts`), matching every other
notification type in the codebase; no migration needed to add it.

## 8. Non-goals

- **Superseded in part by `notification_channel_settings_spec.md`**: a push
  (in-app) toggle for this alert now exists on the Settings page, gating
  `notifyMatchingCarriers` by `preferences.notifications.inApp.
  carrierRouteMatch`. What is still true: no **email** channel for this
  alert, and the per-trajet `/carrier/trips` switch (`notify_on_match`) is
  unchanged and remains the thing that decides whether a route produces
  alerts at all — the Settings checkbox only decides whether the account
  receives them once one fires.
- No standalone "alert me near my current location" concept independent of a
  declared trajet. "Near the carrier" is the trajet's own `radius_km`, applied
  by `isOnPath` exactly as it already is for discovery and for the board's own
  route search.
- No change to `is_discoverable`, its backfill, or the discovery projection.

## 9. Test coverage required

- [ ] `findNotifyCandidates` returns a row with `notify_on_match = true,
      is_discoverable = false` (proves the flags are independent)
- [ ] `findNotifyCandidates` excludes `notify_on_match = false`
- [ ] `findNotifyCandidates` excludes `is_active = false`
- [ ] `findNotifyCandidates` excludes a non-`approved` carrier and a banned
      user, matching `findMatchCandidates`
- [ ] `notifyMatchingCarriers` sends one notification per matching carrier
- [ ] `notifyMatchingCarriers` sends exactly one notification when a carrier
      holds two matching trajets
- [ ] `notifyMatchingCarriers` excludes the listing's own shipper
- [ ] `notifyMatchingCarriers` sends nothing when no trajet matches
- [ ] a failing `createNotification` for one carrier does not stop the next
- [ ] `createListing` fires the alert on an immediate publish
- [ ] `createListing` does not fire the alert on a draft or a scheduled
      publish (fires later, from `publishScheduled`)
- [ ] `publishScheduled` fires the alert for a listing whose scheduled instant
      arrived
- [ ] `escalate` fires the alert on a normal (non-direct) escalation
- [ ] `escalate` called with `directAssignment: true` does **not** fire the
      alert
