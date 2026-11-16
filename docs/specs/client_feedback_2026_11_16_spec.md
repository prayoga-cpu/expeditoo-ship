# Spec — Nicolas's feedback of 16 November 2026

## 1. A driver application must be visible where an admin looks

**Was.** An applicant holds no `carrier`/`driver` role until approval (`carrier.service.ts`), so the
role column of `/admin/users` was blank. The only trace was the « Dossiers » tab of `/admin/drivers`,
whose status column sat last in a table that scrolls sideways on a tablet.

**Now.**
- `GET /api/admin/users` returns `driverApplication` per user: the `carrier_status` of their file, or
  `null` when they never started one. One query per page (`carriersDal.statusesByUserIds`).
- The role column shows a chip, linking to `/admin/drivers?tab=applications`:
  `submitted` → « Candidature chauffeur · à examiner » (orange);
  `under_review` → « … · en cours d'examen » (orange);
  `draft` → « Dossier chauffeur non envoyé » (muted).
  Any other state shows no chip: the role chip already says it, or the file is closed.
- The « Dossiers » tab carries a count badge, the same number as the sidebar's `applications`
  (`submitted` + `under_review`).
- The status column of the applications table is the third column, right after the applicant.

## 2. Driver access is earned, not granted from a list

**Was.** « Gérer le rôle » offered « Chauffeur »; `assignRole` wrote `carrier` and `driver` with no
carrier row behind them, i.e. a driver nobody had vetted who could bid.

**Now.**
- The dialog no longer offers « Chauffeur »; it says so and links to the applications.
- `assignRole` answers `{ success: false, message }` for `carrier` or `driver` unless the target's
  carrier row is `approved`. Approval (`approveApplication`) and `reinstate` grant the roles through
  their own path and are unaffected. **Removing** the Driver chip is unchanged.

## 3. A driver can find where to offer a price

**Was.** A job card was one link; « Immédiat » was its only coloured element. The offer form is the
last block of the job page, below the fold on a tablet. The owner of a job, and an operator without a
driver account, saw nothing at all where the form would be.

**Now.**
- `JobCard` takes `offerAction`. When set, a « Faire une offre » button sits under the card and goes to
  `/listing/:id#offer`. The card's own link wraps its content, not the button (no link in a link).
  `JobBoard` sets it for every job that is not the viewer's own and that `hasBid` does not mark.
- `JobBidSection` marks the form `id="offer"` (`OFFER_ANCHOR`, `listing/offer-anchor.ts`) and scrolls
  to it on mount when the URL carries `#offer`.
- While the form is shown, a floating « Faire une offre » button (below `xl`, above the safe area)
  scrolls to it, and hides while the form is on screen.
- The requester of an open job reads « C'est votre demande » instead of an empty space.
- An `admin` or `operator` without the `carrier` role reads that staff accounts do not offer a price
  and where an Expedion job is awarded, instead of « Devenir transporteur ».
- A signed-out visitor still sees nothing.

## Test coverage required

- `user.service`: `getUsers` carries `driverApplication`; `assignRole` of `carrier`/`driver` is refused
  for no file / `submitted` / `rejected`, allowed for `approved`; other roles unaffected.
- `UsersTable`: chip for `submitted`, `under_review`, `draft`; none for the other states; link target.
- `RoleManagementDialog`: pointer shown while not a driver, hidden once one.
- `JobCard`: no button by default; button with the right href; no nested links.
- `JobBidSection`: `#offer` anchor around the form; owner note; staff note; ordinary account still
  invited to apply; signed-out sees nothing.
