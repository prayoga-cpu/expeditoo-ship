# Spec — The Drivers page, managed by state (2.88.0)

Admin feedback of 17 November 2026: « what is Contact confirmed? », « some buttons are cropped »,
« what are Deregister and Restore driver access on an Active driver? ». Screens:
`CarrierApplicationsList.tsx` (the page) and `CarrierApplicationDetail.tsx` (the file in a dialog).

## 1. Facts the screen must make obvious

- **« Contact confirmed » gates nothing.** It records who reached the applicant and when
  (`carriers.contact_confirmed_at/_by`). Approval is a separate click. It is therefore shown only
  while a file is awaiting a decision, named « Candidat joint » / « Applicant reached », and counted
  in the list so it works as a worklist.
- **Away, Suspend and Remove are three different verbs.** Away = temporary, no new work, driver or
  admin. Suspend = the admin blocks the account, reversible by *Reactivate*. Remove
  (`carrierService.deregister`) = the driver leaves the platform: refused while a run is live
  (`CARRIER_HAS_LIVE_RUNS`), pending bids withdrawn, earned payouts still payable, they may re-apply.
- **« Restore driver access » was a repair, not an action.** It re-ran `approve` on an approved
  file to backfill the role and the fleet link. It is now **« Repair access »**, offered only when
  the account really lacks the role its kind earns (`hasDriverAccess === false`).

## 2. Actions by state (`lib/carrier-actions.ts`, one table, tested)

| Status | Primary | Secondary (visible) | « More actions » menu |
|---|---|---|---|
| draft | Approve | — | — |
| submitted / under_review | Approve | Reject | — |
| approved | — | — | Mark as away · Suspend account · Remove driver |
| approved + away | End absence | — | Suspend account · Remove driver |
| suspended | Reactivate | — | Remove driver |
| rejected | Approve anyway | — | — |
| deregistered | Reactivate driver | — | — |

The footer shows at most **Close · secondary · More actions · primary**, wraps instead of clipping,
and each reason step states the consequence in one sentence (`suspendHelp`, `removeHelp`,
`absentHelp`). Reject stays visible (a review has two decisions); the menu holds the rest.

## 3. The page

- Tabs: **To review** (submitted, under review) · **Active** · **Away or suspended** · **Closed**
  (rejected, removed) · **Not submitted** (drafts) · **All**, each with a count. The default is
  *To review*, or *Active* when nothing waits. Tabs filter client-side from one unfiltered fetch.
- Filters: driver type (All / In-house / Outside) and « Not reached yet » (contact not confirmed).
- Columns: Applicant · Status · Type · Company · Contact · City · Documents (`accepted/total`) ·
  Fleet · Date. The 2.85.0 rule stands: status stays next to the applicant.
- The file leads with the person, shows the type beside the status, and for an approved, suspended
  or away driver shows completed runs, rating and vehicles. Banking is hidden for an in-house
  driver; the contact-confirmed tick is hidden once a decision exists.

## 4. API

`GET /api/admin/carrier-applications` rows gain `hasDriverAccess: boolean` (the owner holds the role
`ROLE_FOR_KIND[kind]` names) and **lose** `user.roles`. No migration.

## 5. Test coverage required

`carrier-actions.test.ts` (every row of §2, tab membership, tab counts, filters) ·
`CarrierApplicationDetail.availability.test.tsx` (footer per state, menu, repair banner, reason steps) ·
`carrier.service` list test for `hasDriverAccess` · `changelog.test.ts` (release records).

## 6. Not done (and why)

- Side sheet instead of a dialog: the dialog now holds its content, a sheet is a pure restyle.
- Live-run count in the file: needs a new query on a per-row list.
