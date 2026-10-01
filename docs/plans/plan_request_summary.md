# Plan — Request summary, direct requests in admin, signed-in name

Client feedback of 2026-09-29, six WhatsApp notes on `/home`, `/listings/me`,
`/admin/expedion` and the header. Contract: `docs/specs/request_summary_spec.md`.

## Steps

1. **Driver invite gating** — `src/features/app/dashboard/driverInvite.ts`
   (pure `showsDriverInvite`), read by `useDriverDashboard`, rendered by
   `DriverDashboard`. No server change: `useMyRequests()` is already fetched.
2. **Request summary** — `src/features/app/listing/ui/RequestSummary.tsx`,
   used by `MyRequestStatusCard` (`DriverDashboard.tsx`) and `JobRow`
   (`MyRequestsPanel.tsx`). Reads only fields `Job` already carries.
   Keys under `myJobs.summary.*` in both locales.
3. **Admin origin filter** — `adminListingsQuerySchema.origin`,
   `listingsService.adminList`, `listingsDal.adminList`.
4. **Admin client API** — `src/features/app/admin/api/listings.api.ts`;
   `useAdminListings` moves onto it, drops `refetchOnMount: false`, and a new
   `useRecentDirectRequests` reads `origin=direct&limit=5`.
5. **Supervision panel** — `RecentDirectRequestsPanel` under
   `RecentQuotesPanel` in `ExpedionDashboard`. Keys under
   `admin.expedion.directRequests.*`.
6. **Annonces** — origin badge and route in `ListingsTable`; `/admin/listings`
   holds the opened listing in `?id=` so the Supervision panel can deep-link.
7. **Header name** — `src/components/layouts/HeaderAccount.tsx`, rightmost in
   `MainLayout`, `AdminLayout`, `DriverLayout`.
8. Spec §2.4 of `listing_posted_feedback_spec.md` points at the new spec.
9. `LocaleProvider` passes the browser's time zone to next-intl, so the
   summary's dates do not start `/home` logging `ENVIRONMENT_FALLBACK`.
10. Tests per the spec's coverage list; FR/EN parity; release 2.55.0.

## Dependencies

None on the database. No migration, no new route, no new env var.
