# Plan — listing privacy (2.60.0)

Contract: `docs/specs/listing_privacy_spec.md`.

1. `src/server/services/listing-view.ts` — the classified column lists, the
   relation projections, `toListingView`, `listingAudience`, and
   `resolveListingViewer` (staff roles + carrier approval, read once per
   request).
2. `listings.service.ts` — `browse`, `getListing` and the new
   `getOpenListingsOf` take a viewer and return views.
3. Routes — `GET /api/listings` and `GET /api/users/:id/listings` require a
   session; the users route goes through the service.
4. `offers.service.ts` — project bids for the requester (`full` scope) and the
   listing inside a carrier's own bids.
5. `shipment.service.ts` — project the parties for the requester and the
   carrier, beside the existing driver redaction.
6. Client — optional street fields in `Job`; `JobDetail` endpoint note and
   error state; copy FR/EN.
7. Tests per spec §5; release records.

Risk: an internal caller relying on `listing.shipper.stripeCustomerId`
(`offers.service.ts` award path) reads the DAL, not these views, so the DAL
stays permission-blind and unchanged.
