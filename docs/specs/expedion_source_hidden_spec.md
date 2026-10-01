# Spec — Expedion Enchères is not announced to drivers

Plan: `docs/plans/plan_listing_reference.md`. Client request, 2026-09-29, on
a screenshot of the job board: _"No need to inform about expedion-Encheres"_.

## 1. Rule

No screen a **driver, carrier or requester** uses inside the app names
Expedion or Expedion Enchères, links to it, or marks a job by its origin.
Where a job came from is an operator's concern.

This reverses the source banner added to `/expedion`, whose stated purpose was
to tell drivers where the work comes from. The client does not want that.

## 2. Removed

| What | Where |
|---|---|
| The source banner (Expedion wordmark, « Les missions marquées « via Expedion » en proviennent… », « Ouvrir Expedion ») | `ExpedionSourceBanner.tsx`, deleted; its mount in `JobBoard.tsx` |
| « via Expedion » badge on a board card | `JobCard.tsx` |
| « via Expedion » badge on the job page | `JobDetail.tsx` |
| "via Expedion" badge (hardcoded English) on « Mes demandes » rows and delivered cards | `MyRequestsPanel.tsx`, `DeliveredRequestCard.tsx` |
| Keys `jobBoard.source.*`, `jobBoard.card.viaExpedion`, `myJobs.detail.viaExpedion` | `messages/fr.json`, `messages/en.json` |
| « Job escaladé depuis Expedion Enchères. », appended to **every escalated job's description**, which drivers read on the job page | `buildDescription` in `expedion-escalation.service.ts` |
| The same sentence in jobs already stored | migration `0034_escalated_description_source`: exact match, `origin = 'expedion'` only, re-runnable |
| « Devis Expedion payé, escaladé sur la place de marché… » in the beta seed's lot, which escalation copies into the job | `src/scripts/beta-fixtures.ts` |

## 3. Reworded

| Key | Was (FR) | Now (FR) | Now (EN) |
|---|---|---|---|
| `jobBoard.empty.none` | « … Elles apparaissent dès qu'Expedion en escalade une. » | « Aucune mission ouverte pour le moment. Les nouvelles missions apparaissent ici dès leur publication. » | "No jobs are open right now. New jobs appear here as soon as they're posted." |
| `deliveries.confirmation.channel.expedion_app` | « via l'application Expedion » | « via son application mobile » | "via their mobile app" |

The confirmation channel **value** `expedion_app` is unchanged; only its label.

## 4. Kept, deliberately

- **`listings.origin` and every behaviour it drives**: who awards (operator
  vs requester), who is charged, the `/expedion` route path and its
  `origin` filter, the award queue. Only the *label* goes.
- **Admin and operator surfaces** (`/admin/expedion`, `/admin/expedion-clients`,
  the award queue's copy, `admin.users.origin.expedion`): operators run the
  bridge and must see it.
- **The public marketing site**, which presents Expeditoo as part of the
  Expedion group. That is a brand decision, not what the client pointed at;
  raise it with them separately.
- `deliveries.cancelFeedback.systemAccount` (« Ce transport appartient à
  Expedion… »): only reachable by acting as the system account, i.e. staff.

## 5. Test coverage required

- [ ] `JobBoard` renders no Expedion wordmark, text or link.
- [ ] `JobCard` for an `origin: "expedion"` job renders no "via Expedion".
- [ ] `JobDetail` for an `origin: "expedion"` job renders no "via Expedion".
- [ ] No key under `jobBoard`, `myJobs` or `deliveries.confirmation` in either
      locale contains "Expedion".
- [ ] An escalated job's generated title and description do not contain
      "Expedion", and the description still carries the pickup, bordereau and
      packaging lines and stays over its 20-character floor.
- [ ] `0034` strips the sentence from an escalated job, leaves a direct job
      with the same words untouched, and changes nothing on a second run.
