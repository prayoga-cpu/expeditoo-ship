# Request summary, direct requests in admin, and the signed-in name

Status: current (2026-09-30). Plan: `docs/plans/plan_request_summary.md`.

Client feedback of 2026-09-29, verbatim:

> This item field is for the carrier only, not the asker. So it should be
> deleted. It should appear when the carrier or asker want to deal.
>
> About this field, the asker should have a summary with all the informations
> of his ad. Same line as item sofa: departure and arrival city, and details
> for appointments and protection level.
>
> Same with field « my asks ».
>
> I don't see the new ad in administration panel. Is it only airtable import?
>
> Please add the name and firstname of user in top right.

## 1. The "become a driver" card on `/home`

`DriverDashboard` renders the *Commencez à rouler avec EXPEDITOO* card
(`dashboard.getStarted`) only when `showsDriverInvite` returns true:

| Carrier application | Caller's own requests (`GET /api/listings/me`) | Card |
|---|---|---|
| exists (any status) | — | hidden (the application banner shows instead) |
| none | still loading | hidden, so a requester never sees it flash |
| none | ≥ 1, any status including `draft` and `scheduled` | **hidden** |
| none | 0 | shown |
| none | request failed | shown (the pre-2.55 behaviour; a lost invite costs more than a stray card) |

"When they want to deal" is already served: a signed-in non-carrier opening an
open job gets `BecomeCarrierCard` (`JobBidSection.tsx`), which links to
`/carrier/application`. No new entry point is added.

## 2. The request summary

One component, `RequestSummary` (`src/features/app/listing/ui/`), renders a
`Job` for its requester. It is used by:

- **`/home` → *Votre demande*** (`MyRequestStatusCard`): status badge, offer
  count and budget, then the summary, then *Voir ma demande*.
- **`/listings/me` → *Demandes*** (`JobRow`): status and origin badges, the
  summary, budget and offers on the right, posted date in the footer.

The summary shows, in order:

1. **Title and route on one line**: `sofa · Bruxelles → Paris`, wrapping onto
   a second line only when the width runs out. Cities, never street addresses.
2. **Retrait / Pickup**: `pickupFrom`–`pickupUntil` as one range
   (`format.dateTimeRange`, day + short month + hh:mm). A same-day window
   collapses to `26 sept., 09:00 – 12:00`.
3. **Livraison / Delivery**: `dropoffFrom`–`dropoffUntil`, same format.
4. **Protection**: `packagingLevel` labelled with the job page's own words
   (`myJobs.detail.packaging.*`: *Protégé* / *Emballé*). `null` reads
   *Non précisée* / *Not stated*, never "unprotected" (the schema's rule for
   this column). `isFragile` appends *Fragile*.
5. **Marchandise / Load**: `weightKg` as `N kg` (the job page's format),
   `quantity` when above 1, and *Aide au chargement* when `needsHelp`.
6. *Dates flexibles* when `isFlexible`.

No server change: every field is already on `Job` from `GET /api/listings/me`.

Times are in the browser's time zone, as on the job page (`JobDetail` formats
with date-fns in local time). `LocaleProvider` now passes that zone to
next-intl as `timeZone`. That is the zone next-intl was already falling back
to, so no rendered time changes, but formatting a date through next-intl no
longer logs `ENVIRONMENT_FALLBACK`. Before this, `/home` had no next-intl date
and did not log it; the summary would have made it start.

## 3. Direct requests in the admin panel

**Answer to the client's question:** yes. Before this change, *Supervision*
(`/admin/expedion`) listed rows from `expedion_quotes` only, which means the
Airtable import and Expedion-app quotes. A request posted at `/create` is a
`listings` row with `origin = 'direct'` and appeared only under *Annonces*.

### 3.1 API

`GET /api/admin/listings` accepts an optional `origin` ∈
`listingOriginEnum` (`direct` | `expedion`). Omitted means both. An unknown
value is a 400 (`VALIDATION_ERROR` from the Zod parse). Permission is
unchanged: admin or operator, else `FORBIDDEN_ROLE`.

### 3.2 Supervision

A *Demandes directes* card sits directly under *Devis récents*:

- Heading with the total count of direct requests (the response's `total`).
- The five newest, each with title, `pickupCity → dropoffCity`, status badge,
  budget, requester name and posted date. Each row links to
  `/admin/listings?id=<listing id>`.
- *Voir toutes les annonces* links to `/admin/listings`.
- Empty: `CenteredEmptyState` saying no requests have been posted yet.
- Error: `CenteredEmptyState` with an error message. Never blank (gotcha 9).

### 3.3 Annonces

- Each row carries its origin: *Directe* or *via Expedion*, and its route.
- The opened listing is held in `?id=`, so a deep link opens it and the
  browser's Back returns to the table.
- The list refetches when the page mounts. It used to keep a five-minute cache
  with `refetchOnMount: false`, so an admin who had opened Annonces before a
  request was posted kept seeing the old list.

## 4. The signed-in name, top right

`HeaderAccount` is the rightmost control in all three shells (`MainLayout`,
`AdminLayout`, `DriverLayout`):

- The avatar is `user.image` when set, else initials from `user.name` (first
  letter of the first two words, upper-cased). With no name it falls back to
  the email's first letter.
- `user.name` is shown in full from `md` up. Below `md` only the avatar shows,
  because the mobile header row is already full.
- The whole control links to the shell's profile: `/profile`, `/admin/profile`
  or `/driver/profile`. Its accessible name is the user's name.
- Renders nothing while the session resolves or with no user.

Signup collects one *Nom complet* field (`user.name`), so "prénom et nom" is
that field. There is no separate first/last-name column and none is added.

## Test coverage required

- [ ] `showsDriverInvite`: every row of the §1 table.
- [ ] `RequestSummary`: route on the title line, both windows, protection
      label, *Non précisée* for `null`, fragile, quantity, flexible, FR and EN
      with no missing-message errors.
- [ ] `adminListingsQuerySchema`: accepts `direct` / `expedion` / absent,
      rejects anything else.
- [ ] `listingsService.adminList`: passes `origin` through; refuses a non-staff
      viewer.
- [ ] `RecentDirectRequestsPanel`: rows with deep links, total, empty state,
      error state; and `ExpedionDashboard` renders it under the quotes.
- [ ] `HeaderAccount`: name, initials, email fallback, profile href, nothing
      while loading.
