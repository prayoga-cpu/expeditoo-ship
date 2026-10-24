# Plan — client feedback of 21 October 2026 (2.65.0)

Spec: `docs/specs/client_feedback_2026_10_21_spec.md`. Monitor: top of `STATUS.md`.
Source: `Expeditoo_retours_Nicolas_21-10-2026.pdf` (19 points, 4 actions).

## Steps

| Step | Item | Files | Depends on |
|---|---|---|---|
| 1 | Analyse every point against code and production (read-only) | — | — |
| 2 | A1 actionable count, worklist tab | `expedion-report.dal.ts`, `admin-nav.dal.ts`, `RecentQuotesPanel.tsx`, `ExpedionDashboard.tsx` | — |
| 3 | A2 initial sort, « Reçu » | `data-table.tsx`, `RecentQuotesPanel.tsx` | 2 |
| 4 | A3 migration `0040`, quote number | schema `expedion.ts`, `quote-reference.ts`, `QuoteReferenceCell.tsx`, report/clients DAL + dialogs | — |
| 5 | A4 reference format | `listing-reference.ts`, `ListingReference.tsx`, every caller | — |
| 6 | A5 shipments overview | `shipments.dal.ts`, `shipment.service.ts`, admin route, hook, `DeliveriesTable.tsx` | 5 |
| 7 | B1 award queue | `AwardQueue.tsx`, `admin-nav.dal.ts` | 5, 9 |
| 8 | B3 origin tooltip | `ListingsTable.tsx` | — |
| 9 | B5 urgency | `urgency.ts`, `UrgentBadge.tsx`, board card, job page, lists | — |
| 10 | B4 / D3 job page | `JobDetail.tsx` | 5, 9 |
| 11 | B6 budget in thread | `ThreadOfferBubble.tsx`, `MessageDetail.tsx` | — |
| 12 | C4 refusal logging, French reset | `email.ts`, `auth.service.ts`, `PasswordResetEmail.tsx`, `reset-password/page.tsx` | — |
| 13 | D1 / D2 views | `RequestViews.tsx`, `MyRequestsPanel.tsx`, `DriverDashboard.tsx`, `myRequestStatus.ts` | 9 |
| 14 | D4 audit | `useCarrierOffers.ts`, `useMessages.ts` | — |
| 15 | D5 search | `conversation-search.ts`, `messages.dal.ts`, `useMessages.ts`, `Messages.tsx` | 5 |
| 16 | D6 counters | `listings.dal.ts`, `listings.service.ts`, route, `RequestActivityCard.tsx` | — |
| 17 | X1 migration `0041`, heartbeat, admin card, display status | schema, DAL, `cron-health.service.ts`, five cron routes, `CronStatusPanel.tsx`, `statusTone.ts` | — |
| 18 | Copy: one patch, FR/EN parity | `messages/*.json` | 2–17 |
| 19 | Gates, migration run on a scratch database, Chromium pass | — | 18 |
| 20 | Release 2.65.0: CHANGELOG, STATUS, version | — | 19 |

## Order of the production push

`0040` adds a column with a default and a backfill over 4,658 quotes, and
`0041` adds a table; both are additive, so old code runs on a migrated
database. New code on an unmigrated one would 500 Supervision (it selects
`reference` from `expedion_quotes`) and the cron routes' heartbeat writes would
log and carry on. So: **Actions → Migrate database first, then the deploy.**

Then the owner sets `APP_URL` and `CRON_SECRET` in GitHub. The first run
expires the backlog of stale listings in one go and auto-publishes any paid
quote past its deadline — at the time of writing `a-111-02`, a 1 € test quote.
Cancel that quote first if it should not reach the board.
