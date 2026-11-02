# Plan — no dead ends

**Spec:** `docs/specs/no_dead_ends_spec.md` · **Release:** 2.75.0

**Asked by the owner (2026-10-31)**, after the accept dialog refused a payment
with nothing but « Fermer »: « fix this, make sure there's no blocked on the
app, and always has way to go ahead/alternative or close/edit/cancel on every
necessary features », then « check the others section/pages as well then
prevent and solve ». The cause of that refusal (a request with no map pin)
shipped separately as 2.73.0; this is everything around it.

## Steps

1. **Accept dialog** — every refusal names a next step (`NEXT_STEPS` in
   `AcceptPaymentDialog.tsx`); the caller hands in the two only it can offer
   (`nextSteps.editRequest`, `nextSteps.carriers`).
2. **A live request can be changed or called off** — `POST
   /api/listings/:id/unpublish` (open → draft, offers expired, carriers told)
   and the existing `DELETE /api/listings/:id`, behind `RequestActions` on the
   job page and in « Mes demandes ». `cancelListing` becomes a
   compare-and-set and tells carriers too.
3. **An ended request can be posted again** — `POST /api/listings/:id/repost`
   copies it into a new draft (`listingsDal.copyAsDraft`).
4. **Failed reads** — one component, `LoadErrorState`, with a retry and an
   optional way back; every query surface that rendered a failure as red text,
   as « nothing here », or as a form for a file that exists gets it.
5. **Empty states** — a way on where one exists (`common.nextSteps.*`).
6. **Carrier and driver refusals** — the toast carries the one action that
   answers it; a carrier who already bid sees the bid, not a second form;
   « Mes offres » translated.
7. **Prevention** — `src/__tests__/no-dead-ends.test.ts` reads the source and
   fails on a failure branch with no retry or an empty state with no action,
   unless an allowlist entry says why.

## Files

Server: `listings.service.ts` (`unpublish`, `repostAsDraft`,
`cancelListing`, `notifyOffersWithdrawn`), `listings.dal.ts` (`copyAsDraft`),
two new routes. Client: `components/ui/load-error-state.tsx`,
`listing/ui/RequestActions.tsx`, `listing/hooks/useRequestActions.ts`,
`AcceptPaymentDialog.tsx`, `JobDetail.tsx`, `JobBidSection.tsx`,
`MyOffers.tsx`, and the ~30 screens listed in the spec §4–5. Copy:
`messages/{fr,en}.json`.

## Dependencies

None new. No migration: `unpublish` writes statuses that exist, and
`copyAsDraft` inserts a row. Shared-tree peers: 2.74.0 (`expeditoo-ship-74`)
edits `JobDetail.tsx` (header, load, endpoints) and `listings.service.ts`
(`toColumns`, `flattenUpdate`); this touches neither region.
