# Spec — feedback when a direct request is submitted

## 1. Trigger

`listingsService.createListing(shipperId, data, opts)` fires the behaviour
below exactly once, synchronously after `listingsDal.create` (and, if any,
`listingsDal.addPhotos`) resolve, when **both**:

- `data.publish === true` (a draft save, `publish: false`, never fires this —
  nothing was posted for anyone to bid on yet), and
- `!isSystemAccount(shipperId)` (`src/server/services/account-policy.ts`) —
  the account that owns every Expedion-escalated listing is excluded, because
  nobody signs into it to read an email or a bell notification.

This makes the one caller that reaches `createListing` with the system
account — `expedionEscalationService.escalate` — a silent no-op for this
feature, by construction rather than by a special case in that file.

Draft → publish later, via `publishListing`, is **not** covered by this spec.
`publishListing` is a different code path (it does not call `createListing`)
and firing this from there too is a separate, reviewable decision.

## 2. What fires

All three below are independent: each is wrapped in its own
`.catch((e) => console.error(...))`, matching `invoicesService.announce`. A
failure in one does not stop the others, and none of the three can fail the
`POST /api/listings` response — the listing row already exists by the time
any of them runs.

### 2.1 Notification (bell)

`notificationsService.createNotification`:

| field | value |
|---|---|
| `userId` | `shipperId` |
| `type` | `"listing_posted"` |
| `title` | `"Votre demande est en ligne"` |
| `message` | `` `"${listing.title}" est visible par les transporteurs.` `` |
| `linkUrl` | `` `/listing/${listing.id}` `` |
| `data` | `{ listingId: listing.id }` |

Delivered in real time over the existing Ably path
(`notificationsService.createNotification` already publishes to
`ablyServer.publishNotification`); no new wiring needed there.

### 2.2 Email (Resend)

`emailService.sendListingPostedEmail(to, params)`, added to
`email.service.ts` alongside the other `send*Email` methods, `to` = the
poster's `user.email`, looked up via `getUserById(shipperId)`
(`src/server/dal/users.dal.ts`). If that lookup somehow returns no email
(cannot happen for an authenticated session in practice, but the code does
not assume it), the email step is skipped — the notification and toast still
fire.

Renders `TransportRequestReceivedEmail` (new template, French, styled like
`ConfirmationRequestEmail.tsx` — a bordered card, one heading, one CTA
button, no logo asset):

- Heading: "Votre demande de transport est en ligne"
- Body: names the job (`listing.title`), the route (`pickupCity → dropoffCity`),
  the budget (`formatCurrency(listing.budgetCents)`), and says plainly that
  carriers can now bid and the poster chooses who takes it — this is the
  direct inlet, so the poster is the awarder, not an operator.
- CTA: "Voir ma demande" → `${NEXT_PUBLIC_APP_URL}/listing/${listing.id}`
- Subject: `"Votre demande de transport est en ligne"`

This is a **submission confirmation, not a payment receipt** — no money has
moved (`payment_at_booking_spec.md` §4: the charge happens when a carrier is
chosen). The existing capture-time invoice email
(`invoice_at_payment_spec.md`) is unrelated and unchanged.

### 2.3 Toast

Already implemented (`useJobForm.tsx`, `createJob.onSuccess`,
`toast.success(t("toast.posted"))`). No change.

### 2.4 Homepage status

`/home` (`DriverDashboard.tsx`) gains a card, rendered when the caller has at
least one of their own listings whose status is `open`, `awarded` or
`in_progress` — i.e. something currently worth watching. Selection:

- Filter the caller's listings (`GET /api/listings/me`, already used by
  `/listings/me`) to those three statuses.
- Among matches, the most recently created wins
  (`featuredRequest` in `src/features/app/dashboard/myRequestStatus.ts`).
- No match → the card renders nothing (not an empty state; the dashboard
  already omits sections that don't apply, e.g. the stat tile for live offers
  when the driver isn't approved).

The card shows: a status badge (same tone/labels as `/listings/me`'s
`STATUS_TONE` and `myJobs.status.*`), the job title, the offer count
(`myJobs.offers`), and a link to `/listing/:id`.

`completed`, `cancelled`, `expired` and `draft` are deliberately excluded —
the first three belong to history (`/listings/me`'s delivered tab and the
status filter already cover them), and a draft is not "a request" yet.

## 3. Edge cases

- **Draft saved, never published**: nothing in this spec fires. Publishing it
  later via "Publish" is out of scope (see §1).
- **Escalated (Expedion) listing**: nothing in this spec fires (§1's second
  guard). The Expedion client's own confirmation is a separate, already-shipped
  mechanism (the Expedion app itself).
- **Two direct requests open at once**: the dashboard card shows only the most
  recently created; the rest are still visible on `/listings/me`.
- **Email send fails (Resend error, network)**: logged via `console.error`,
  swallowed. The listing is unaffected; the notification and toast already
  fired independently.
- **User has no saved email** (should not happen for an authenticated
  account): email step is a no-op; notification/toast unaffected.

## 4. Non-goals

- No preference toggle to disable this email. `orderConfirmation` in
  `preferences.dto.ts` is a leftover of the same goods-auction era as the dead
  email methods and is not repurposed here — its name would mislead the next
  reader into thinking it already governs this.
- No change to `sendOrderConfirmationEmail`, `sendPaymentReceiptEmail`,
  `sendShipmentAssignedEmail` or `sendShipmentUpdateEmail` — flagged as dead
  in the plan, not removed here.

## 5. Test coverage required

- `listings.service.test.ts`:
  - `createListing` with `publish: true` calls both
    `notificationsService.createNotification` (type `listing_posted`) and
    `emailService.sendListingPostedEmail`.
  - `createListing` with `publish: false` calls neither.
  - `createListing` called with the system account's id calls neither, even
    with `publish: true`.
  - A rejection from either dependency does not reject `createListing`'s own
    promise.
- `email.service.test.ts`: `sendListingPostedEmail` renders and sends with the
  right `to`/subject.
- `src/features/app/dashboard/__tests__/myRequestStatus.test.ts`:
  `featuredRequest` — picks the most recent among `open`/`awarded`/
  `in_progress`; ignores `draft`/`completed`/`cancelled`/`expired`; returns
  `null` on no match; empty list in, `null` out.
- `src/i18n/__tests__/locale-parity.test.ts` continues to pass with the new
  keys added to both `messages/en.json` and `messages/fr.json`.
