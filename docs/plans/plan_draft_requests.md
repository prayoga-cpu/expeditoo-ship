# Plan — finishing a saved request (2.60.0)

Contract: `docs/specs/draft_requests_spec.md`.

1. Migration `0036_listing_published_at` (+ journal) and the Drizzle column;
   classify it in `listing-view.ts`.
2. DAL: `getOwnedUnpublished`, `updateUnpublished` (conditional),
   `deleteUnpublished` (conditional), `replacePhotos`; `publishScheduled`'s
   update made conditional; board ordering on `published_at`.
3. Service: `toColumns` shared by create and save; `goLive` (announcement +
   carrier alerts) shared by create and save; `getDraft`, `saveDraft`,
   `deleteDraft`, `unschedule`; `publishedAt` stamped on going live; remove
   `publishListing`.
4. Routes: `GET/PUT/DELETE /api/listings/:id/draft`,
   `POST /api/listings/:id/unschedule`.
5. Client: `from-listing.ts` (+ `cargo.ts` reverse helpers, the fragile split);
   `jobsApi.saveDraft`; `create/page.tsx` server wrapper + `DraftForm`;
   `useJobForm({ draft, startStep })`; `DraftActions` on « Mes demandes » cards
   and the draft's page; JobDetail banner, no offers section, `scheduled` badge
   tone; the card dates.
6. Copy FR/EN; tests per spec §7; amend `transport_listing_spec.md`,
   `listing_posted_feedback_spec.md` §1, `publication_timing_spec.md` §2,
   `request_posted_page_spec.md` §1.
7. Production runs `0036` before the deploy (Actions → Migrate database, from
   the release branch).

Depends on the numeric-input stream for `centsToInput` and the budget field's
text representation.
