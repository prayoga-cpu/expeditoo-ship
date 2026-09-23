# Plan — per-channel notification settings

Reference: Cocolis's Notifications screen (user-supplied screenshot) — each
category is its own box with one checkbox row per channel ("Par e-mail",
"Par notification push"), rather than one checkbox per category.

## Steps

1. **Schema/DTO**: add `carrierRouteMatch: boolean` to the `inApp` preferences
   shape (`src/db/schema/users.ts`, `src/server/dto/preferences.dto.ts`),
   default `true`. `GET`/`PATCH /api/user/preferences` already deep-merge
   `inApp` against defaults, so no route change needed.
2. **Wire `inApp.shipmentUpdates`**: `shipment.service.ts`'s `updateStatus`
   currently fires the shipper's bell notification unconditionally. Gate it
   the same way `emailShipmentUpdate` already gates the email, fail-open on a
   lookup error.
3. **Wire `inApp.carrierRouteMatch`**: `carrier-routes.dal.ts`'s
   `findNotifyCandidates` already joins `user`; add `user.preferences` to its
   projected columns (a new `findNotifyCandidates`-only column set, discovery
   stays untouched) and skip `createNotification` in
   `carrier-route-alerts.service.ts` when the carrier turned the checkbox off.
4. **`useSettings` hook**: expose `inApp` alongside `email`, and make
   `handleNotificationChange` channel-aware (`"email" | "inApp"`).
5. **`Settings.tsx`**: restructure the notifications section into one bordered
   box per category (title + description + a channel-checkbox row per
   available channel), add the new "route match alerts" category, rename the
   section from "Email Notifications" to "Notifications".
6. **i18n**: add `settings.notifications.channels.{email,push}` and
   `settings.notifications.routeAlerts.{title,description}` to both
   `messages/en.json` and `messages/fr.json`, keeping key parity.
7. **Tests**: extend `carrier-route-alerts.service.test.ts` for the new
   preference gate; add a `shipment.service.ts` test (or extend the existing
   suite) for the `inApp.shipmentUpdates` gate.
8. **Docs**: update `carrier_route_alerts_spec.md` §8, which explicitly listed
   "no email preference... no push/SMS/email channel" as a non-goal — that
   non-goal is now partly reversed (a push/in-app toggle exists; email still
   does not). Write `docs/specs/notification_channel_settings_spec.md` as the
   spec of record for this change.
9. Session discipline: `CHANGELOG.md`, `STATUS.md`, `package.json`,
   `src/lib/version.ts`.

## Explicitly out of scope

`email.offerReceived/offerAccepted/offerRejected/paymentConfirmation/marketing`
and `inApp.offerReceived/offerAccepted/offerRejected/paymentConfirmation/messages`
stay unread by any service, exactly as today — none of them have a Settings
category to control them, and adding gating with no UI surface would be dead
code. Only preferences a checkbox on this page actually controls are wired.
