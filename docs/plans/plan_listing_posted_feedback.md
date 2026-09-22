# Plan — feedback when a direct request is submitted

## Ask

"Once the user submitted the request transport, automatically send the
receipt/email to the user's inbox using resend, also don't forget to give the
toast, notification on the bell, and status on the homepage."

## What already exists

- **Toast**: `useJobForm.tsx`'s `createJob.onSuccess` already calls
  `toast.success(t("toast.posted"))` when `publish: true`. Nothing to add.
- **Notifications**: a full bell/Ably/DB stack already exists
  (`notificationsService.createNotification`, `NotificationBell`,
  `NotificationPopover`). Adding a type is additive.
- **Email**: `emailService` + Resend are already wired (`src/lib/email.ts`,
  React Email templates under `src/server/emails/`). Several methods there
  (`sendOrderConfirmationEmail`, `sendPaymentReceiptEmail`,
  `sendShipmentAssignedEmail`, `sendShipmentUpdateEmail`) are **dead code from
  the deleted goods-auction era** — called from nowhere but their own tests —
  and use `buyer`/`item`/`shipping` vocabulary. Not reused, per the "no
  goods-auction concepts" rule; a new method is added instead.

## What "receipt" means here

There is no payment to receipt at this point — `payment_at_booking_spec.md`
is explicit that money moves only when a carrier is **chosen**, not when the
job is posted. Step 5 of `/create` only collects a card. So this is a
**submission confirmation**, not a payment receipt: "your request is live,
carriers can now bid." The existing receipt/invoice email at capture
(`invoice_at_payment_spec.md`) is untouched and out of scope.

## Where it fires

`listingsService.createListing`, gated on `data.publish === true` **and**
`!isSystemAccount(shipperId)` (`src/server/services/account-policy.ts`).

The second guard matters: `expedionEscalationService.escalate` also calls
`createListing`, with `shipperId = systemShipperId()` and `publish: true`, and
then patches `origin` to `expedion` right after. Without the guard, every
Expedion escalation would email/notify a system account nobody signs into.

Fires once, after the listing (and its photos) are persisted. Wrapped so a
failure never fails the `POST /api/listings` response — the listing already
exists — matching the `invoicesService.announce` / `expireDueListings`
fire-and-forget-with-`.catch(console.error)` convention already in this file.

## Pieces

1. **Email** — new template `TransportRequestReceivedEmail.tsx` (French,
   matching `ConfirmationRequestEmail.tsx`'s minimal style) + new
   `emailService.sendListingPostedEmail(...)`.
2. **Notification** — new type `listing_posted`, wired into
   `notifications/types.ts`, `NotificationItem.tsx` (color), `useNotifications.ts`
   (icon + link fallback), and both message bundles.
3. **Homepage status** — the driver dashboard (`/home`) shows nothing about a
   person's own posted requests today; it is entirely about their standing as
   a driver. Add a card, `MyRequestStatusCard`, for the most relevant
   `open`/`awarded`/`in_progress` request the caller has posted, reusing the
   existing `GET /api/listings/me` route and the `useMyRequests` cache key so
   `/home` and `/listings/me` share one fetch. Selection logic is a pure,
   tested function (`featuredRequest`), matching how `orderRunsByProgress`
   is tested rather than the hook around it.
4. **`STATUS_TONE`** (the status→color badge map) is duplicated into the new
   card unless extracted once from `MyRequestsPanel.tsx` into a shared
   `src/features/app/listing/statusTone.ts`.

## Files

- `src/server/emails/TransportRequestReceivedEmail.tsx` (new)
- `src/server/services/email.service.ts` (+ method)
- `src/server/services/listings.service.ts` (fire on publish)
- `src/server/services/__tests__/listings.service.test.ts` (+ mocks + cases)
- `src/server/services/__tests__/email.service.test.ts` (+ case)
- `src/features/app/notifications/types.ts`
- `src/features/app/notifications/ui/NotificationItem.tsx`
- `src/features/app/notifications/hooks/useNotifications.ts`
- `messages/en.json`, `messages/fr.json`
- `src/features/app/listing/statusTone.ts` (new, extracted)
- `src/features/app/listing/ui/MyRequestsPanel.tsx` (import instead of redefine)
- `src/features/app/dashboard/myRequestStatus.ts` (new, pure)
- `src/features/app/dashboard/__tests__/myRequestStatus.test.ts` (new)
- `src/features/app/dashboard/hooks/useMyRequestStatus.ts` (new)
- `src/features/app/dashboard/ui/DriverDashboard.tsx` (+ card)
- `docs/specs/listing_posted_feedback_spec.md` (new)
- `CHANGELOG.md`, `STATUS.md`, `package.json`, `src/lib/version.ts` (2.44.0, feat)

## Out of scope

- No preference toggle to mute this email (nothing analogous is wired to a
  settings UI today for anything other than invoices; inventing one is
  speculative).
- No change to the existing capture-time invoice/receipt flow.
- No cleanup of the dead `sendOrderConfirmationEmail`-family code — flagged,
  not removed, since the ask did not cover it and removing dead call-free code
  is a separate, reviewable change.
