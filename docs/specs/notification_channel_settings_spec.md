# Notification channel settings

## 1. What this is

The Settings page's notifications section (`settings.notifications`) grows a
second channel. It was email-only — one checkbox per category, gating an
email send. Some categories now also carry a push/in-app checkbox, gating the
bell notification (`notificationsService.createNotification`, delivered over
Ably) that channel already sends. This follows the layout in a reference
screenshot: each category is its own box, with one checkbox row per channel
that category actually has, not a shared checkbox per category.

"Push" is the UI's word for the in-app/bell channel (`preferences.
notifications.inApp`), matching `ROADMAP.md`'s naming for where this is
headed (real Capacitor push is a later channel on the same preference key) —
not a claim that OS-level push exists today. Flipping the checkbox off stops
`createNotification` from firing for that event; it does not touch Ably
delivery of notifications already created.

## 2. Categories and their channels

| Category | Email key | Push (inApp) key | Notes |
|---|---|---|---|
| Listing published | `listingPublished` | — | No in-app equivalent: the poster is looking at the screen when it publishes. |
| Driver & payment | `invoiceReady` | — | No in-app equivalent exists for this event. |
| Trip & delivery updates | `shipmentUpdates` | `shipmentUpdates` | Email was already gated (`shipment.service.ts`'s `emailShipmentUpdate`); the bell notification (`notify(shipperId, "shipment_update", …)`) was not — this wires it. |
| Route match alerts (new) | — | `carrierRouteMatch` | No email channel — unchanged from `carrier_route_alerts_spec.md`'s original decision. Only a push checkbox. |
| Account & Security | fixed, non-togglable | — | Unchanged: welcome/reset/verification mail can't be turned off, same as today. |

A category only renders the channel rows it has a real preference key for.
There is no row that does nothing when unchecked.

**Deliberately not covered**: `email`/`inApp` keys with no category —
`offerReceived`, `offerAccepted`, `offerRejected`, `paymentConfirmation`,
`marketing`, `messages`. These are unread by any service today and stay that
way; there is no checkbox for them, so gating them would be unreachable code.

## 3. Schema change

`inApp` gains `carrierRouteMatch: boolean`, default `true`, in
`src/db/schema/users.ts` (`UserPreferences` type and `defaultPreferences`) and
`src/server/dto/preferences.dto.ts`
(`inAppNotificationPreferencesSchema`). A JSONB column, so no migration — `GET`
`/api/user/preferences` already backfills missing keys from
`defaultPreferences` on read, and `PATCH` deep-merges per-channel, both
unchanged.

## 4. Gate: trip & delivery updates (push)

`shipment.service.ts`'s `updateStatus`, on `PICKED_UP` / `IN_TRANSIT` /
`DELIVERED`, calls `notify(ownership.shipperId, "shipment_update", …)`
unconditionally today. A new `notifyShipmentUpdate` wraps it: look up the
shipper, skip the call when `preferences.notifications.inApp.shipmentUpdates
=== false`. A lookup failure fails **open** (still notifies) — matching this
file's existing "self-contained failure" convention for
`emailShipmentUpdate`, and the same default-true-on-absent-data rule every
other preference gate in this codebase already follows. `notify()` itself is
untouched — it is also used for `shipment_assigned`, which this category does
not cover.

## 5. Gate: route match alerts (push)

`carrier-routes.dal.ts`'s `findNotifyCandidates` already joins `user`. It
gains its own column projection (`notifyCandidateColumns`, a superset of
`matchCandidateColumns` plus `userPreferences: user.preferences`) so the
discovery query (`findMatchCandidates`) is untouched and carries no extra
payload. `carrier-route-alerts.service.ts`'s `notifyMatchingCarriers` skips
`createNotification` for a matched carrier whose
`userPreferences.notifications.inApp.carrierRouteMatch === false`, checked
after dedup so one carrier with several matching trajets is still counted
once regardless of the flag.

This is a **third** independent consent, alongside `is_discoverable` and
`notify_on_match` (`carrier_route_alerts_spec.md` §2): the per-trajet switch
decides whether a route produces alerts at all; this decides whether the
carrier's account receives them through the push channel once one fires. A
carrier with `notify_on_match=true` on every trajet but the Settings checkbox
off gets no notification, same as one with no matching trajet.

## 6. Frontend

`useSettings` returns `inApp` alongside `email`, read from
`preferencesData.preferences.notifications.inApp`. `handleNotificationChange`
takes a channel (`"email" | "inApp"`), a key valid for that channel, and a
boolean, and PATCHes `{ notifications: { [channel]: { [key]: value } } }` —
unchanged shape, now parameterised by channel instead of hardcoded to email.

`Settings.tsx`'s notifications section renders one bordered box per category
(title, description, then a checkbox row per channel in §2's table). The
section heading changes from "Email Notifications" to "Notifications" since
it is no longer email-only.

## 7. Non-goals

- No email channel for route match alerts (unchanged from
  `carrier_route_alerts_spec.md` §8's original decision — only that
  document's "no toggle in Settings at all" clause is reversed).
- No gating added for any `email`/`inApp` key with no Settings category (§2).
- No real OS-level push (Web Push/FCM/Capacitor push). "Push" here is UI copy
  for the existing in-app/Ably channel.
- No change to `carrier_routes.notify_on_match` or `is_discoverable` — those
  stay per-trajet, independent of this per-account channel preference.

## 8. Test coverage required

- [ ] `updateStatus` sends the shipment-update bell notification when
      `inApp.shipmentUpdates` is unset (default true)
- [ ] `updateStatus` skips it when `inApp.shipmentUpdates === false`
- [ ] `updateStatus` still sends the email independently of the push setting,
      and vice versa (the two channels gate independently)
- [ ] a failed preference lookup still sends the notification (fail open)
- [ ] `notifyMatchingCarriers` sends nothing to a matched carrier whose
      `inApp.carrierRouteMatch === false`
- [ ] `notifyMatchingCarriers` still sends to a matched carrier with no
      `userPreferences` at all (default true)
- [ ] `notifyMatchingCarriers` counts a carrier with two matching trajets and
      the checkbox off as zero notifications, not deduped-then-skipped twice
