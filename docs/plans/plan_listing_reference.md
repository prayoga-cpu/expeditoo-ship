# Plan — job reference, and Expedion no longer announced to drivers

Client feedback, 2026-09-29 (WhatsApp, verbatim):

> _"it should be useful to add the field « ad reference » for users (asker and
> shi[pper]) … And shipper-carrier"_
>
> _(screenshot of /expedion "Voir les demandes" with the Expedion Enchères
> banner)_ _"No need to inform about expedion-Encheres"_

Two open questions went back to the client unanswered; this plan takes the
defaults and says so in `STATUS.md`:

1. **Generated, not typed.** "Ad reference" is read as a *référence
   d'annonce* the platform issues, not a free-text field the requester fills
   in. A requester's own purchase-order number would be a separate column.
2. **The badges go with the banner.** The banner only exists to explain the
   "via Expedion" badge; removing one and keeping the other leaves an
   unexplained badge.

Contracts: `docs/specs/listing_reference_spec.md`,
`docs/specs/expedion_source_hidden_spec.md`.

## Steps

### A. The reference

1. Migration `0033_listing_reference.sql` + journal entry: sequence
   `listing_reference_seq` from 100001, column `listings.reference` NOT NULL
   UNIQUE, existing rows renumbered by `created_at`.
2. `src/db/schema/listings.ts` — the column, DB-defaulted.
3. `src/lib/listing-reference.ts` — `parseListingReference` (search input →
   number | null) and `FIRST_LISTING_REFERENCE`.
4. Server projections that pick listing columns by hand:
   - `listings.dal.ts` `browse` — `q` also matches the reference.
   - `messages.dal.ts` — both `listing: { columns }` picks.
   - `shipment.service.ts` `DRIVER_LISTING_FIELDS`.
   - `earnings.dal.ts` / `earnings.service.ts` — `reference` becomes the job's.
   - `shipment-confirmations.service.ts` — the public page and the email.
   - `listings.service.ts` — the "request is live" notification and email;
     `TransportRequestReceivedEmail.tsx`, `email.service.ts`.
5. Client types: `Job`, `DriverShipmentListing`, deliveries `ShipmentListing`
   and view models, messages `ThreadResponse`/`Conversation`, `AdminListing`.
6. `ListingReference` component (`features/app/listing/ui`), copyable variant.
7. Surfaces: `JobDetail`, `MyRequestsPanel` row, `DeliveredRequestCard`,
   `DeliveryCard`, `DeliveryDetail`, `/driver/shipments/[id]`, `MessageDetail`,
   `CompletedTripCard` (+ panel search), `AwardQueue`, admin `ListingsTable`.
8. i18n `listingReference.*` FR + EN.

### B. Expedion not announced

1. Delete `ExpedionSourceBanner.tsx` and its mount in `JobBoard.tsx`.
2. Remove the "via Expedion" badge from `JobCard`, `JobDetail`,
   `MyRequestsPanel`, `DeliveredRequestCard`.
3. Copy: `jobBoard.empty.none`, `deliveries.confirmation.channel.expedion_app`.
   Drop `jobBoard.source.*`, `jobBoard.card.viaExpedion`,
   `myJobs.detail.viaExpedion`.
4. Found during the browser pass: `buildDescription` ends every escalated
   job's description with « Job escaladé depuis Expedion Enchères. ». Drop it,
   strip it from stored jobs (`0034_escalated_description_source`), and reword
   the beta seed's lot text, which escalation copies into the job.

### C. Close-out

Tests per both specs' coverage lists; `tsc`, `lint`, `test`; Chromium pass
on the board, a job, a delivery and a thread in both themes; release 2.55.0
in `CHANGELOG.md`, `STATUS.md`, `package.json`, `src/lib/version.ts`.

## Dependencies

- The migration must run (Actions → Migrate database) **before** the deploy:
  every surface reads `reference` as non-null.
- No change to the Flutter `expedion_encheres` client.
