# Specification: Becoming a driver from the app shell

Plan: [`docs/plans/plan_become_driver.md`](../plans/plan_become_driver.md).
Supersedes the UI half of the stale v1 `driver_onboarding_spec.md` (which
describes a `driver_applications` table that never existed in this model).
The application itself is unchanged and specified in `carrier_kyc_spec.md`.

## 1. What was wrong

Reported 2026-10-07 on an admin + user account, with screenshots.

1. **« Ajouter l'accès transporteur » bounced.** An admin + user account with
   nothing stored resolves to Admin mode (`resolveAccessMode`), and the
   switcher sits in the admin sidebar too. The row did `router.push
   ("/carrier/application")` without changing mode; that page renders in
   `MainLayout`, whose guard sends Admin mode to `/admin/expedion`. The page
   flashed and the panel came back. Reproduced in Chromium.
2. **On the application page the row was a no-op**: it pushed the URL
   already shown.
3. **The desktop sidebar had no way in.** User mode's sidebar carried no
   application entry, although the mobile bar did, and nothing anywhere
   showed where an application stood.
4. **An approved application on an account without the roles claimed to be
   active.** Production's only admin has an `approved` `carriers` row and
   holds `{shipper, admin}`: the roles were removed after approval. The page
   said « Vous êtes un chauffeur approuvé » while the switcher offered to add
   that very access.

## 2. Rules

- **Nothing here grants a role.** `carrier` and `driver` are granted only by
  an admin approving the application (`roles_spec.md`, `enrolAsOwnDriver`).
  The dialog explains the path and leads to the form; it writes nothing.
- **Opening the dialog writes nothing.** The only request is the existing
  `GET /api/carrier/application`, so an impersonated session may open it.
- **One way to the page.** Every entry below reaches `/carrier/application`
  through `useApplicationNav`:
  - an account that qualifies for Driver mode switches to it first
    (unchanged);
  - otherwise, an account browsing as Admin switches to its first non-admin
    mode first, the same `setMode`-then-`push` shape as
    `AdminLayout.handleBack`;
  - otherwise the mode is left alone. The stored mode is never set to
    `carrier` for an account that does not qualify: `resolveAccessMode`
    would discard it and fall back to the strongest mode, which for an
    admin is Admin, and that bounces (§1.1).

## 3. Entry points

"Has an application" means `GET /api/carrier/application` returned a row.
While it is loading or has failed, the entry behaves as "no application", and
the dialog shows what it knows (§4).

| Where | Shown to | No application | Has an application |
|---|---|---|---|
| Access switcher row | an account with more than one mode and no Driver mode (unchanged rule) | « Devenir chauffeur », opens the dialog | « Mon dossier chauffeur » + status, opens the dialog |
| Desktop sidebar, user mode | everyone in user mode | « Devenir chauffeur », green accent, opens the dialog | « Mon dossier » + status pill, green accent, goes to the page |
| Mobile bar, applicant bar | everyone not in Driver mode | « Devenir chauffeur », opens the dialog | « Mon dossier », goes to the page |

- The sidebar entry sits last among the ordinary entries, directly above
  « Panneau d'administration », and uses the `success` token (the Driver
  badge's colour) the way the admin entry uses `destructive`.
- The switcher row is set apart from the mode rows by a separator and an icon.
  It is never offered once the account qualifies for Driver mode, and there
  is never an "add admin" row (both unchanged).
- The dialog is rendered beside the dropdown, not inside it, and opened from
  the item's `onSelect`, so the menu closes before the dialog takes focus.

## 4. The dialog

Title, body and one primary button, plus « Plus tard ». The primary button
calls `useApplicationNav` and closes the dialog.

| Application | Body | Primary |
|---|---|---|
| none (or still loading / failed) | three steps: your details (name, SIRET, phone, address; a sole trader's SIRET is enough, no Kbis), your documents (ID, licence, insurance, RIB; they can follow the submission), our review (Driver mode then appears in the access menu). A line saying user access stays. | « Commencer ma candidature » |
| `draft` | not submitted yet | « Terminer mon dossier » |
| `submitted`, `under_review`, `rejected`, `suspended` | the page banner's title and description, and the reason when there is one | « Ouvrir mon dossier » |
| `approved`, account qualifies for Driver mode | the approved banner | « Ouvrir mon dossier » |
| `approved`, account does not | `approvedInactive` (§5) | « Ouvrir mon dossier » |

While the query is loading, the body shows the steps (the commonest case) and
the button stays enabled: the page handles every state itself.

## 5. Approved without access

`ApplicationStatusBanner` (application page and driver dashboard) and the
dialog read the session's roles. When the application is `approved` and the
account holds neither `carrier` nor `driver`, the banner uses the
`destructive` variant and reads:

- EN: "Approved, but driver access is off" / "Your application is approved,
  but this account does not have driver access. If you were approved in the
  last few minutes, sign out and back in. Otherwise, contact support."
- FR: « Dossier approuvé, mais accès chauffeur inactif » / « Votre dossier
  est approuvé, mais ce compte n'a pas l'accès chauffeur. Si vous venez
  d'être approuvé, déconnectez-vous puis reconnectez-vous. Sinon, contactez
  le support. »

Restoring the access is an admin action (`/admin/users` role dialog, or
re-approving, which re-runs `enrolAsOwnDriver`); this spec does not add one.

## 6. Status labels

`carrier.onboarding.status.<status>`: draft « Brouillon » / Draft, submitted
« Envoyé » / Submitted, under_review « En examen » / Under review, approved
« Approuvé » / Approved, rejected « Refusé » / Rejected, suspended
« Suspendu » / Suspended.

## 7. Copy

FR and EN at parity, verified by key diff. `common.accessSwitcher.
addCarrierAccess` is removed (its only reader is the switcher) and replaced
by `becomeDriver` / `myApplication`. New `common.navigation.becomeDriver`.
New block `carrier.onboarding`. New `carrier.application.banner.
approvedInactive`.

## 8. Test coverage required

- `use-application-nav`: from Admin mode on a non-driver account the stored
  mode becomes `user` before the push; a driver-qualified account switches
  to `carrier`; a user-mode account's mode is untouched; the stored mode is
  never `carrier` for an account that does not qualify.
- `AccessSwitcher`: the row reads « Devenir chauffeur » with no application,
  and the dossier label plus status with one; selecting it opens the dialog
  and does not navigate; no row once Driver mode is held; no "add admin" row.
- `DriverOnboardingDialog`: steps and « Commencer » with no application;
  status copy for each existing status; `approvedInactive` for an approved
  application on a non-driver account; the primary button navigates to
  `/carrier/application` and closes; FR renders with no missing keys.
- `MainLayout`: user mode shows « Devenir chauffeur » with no application and
  « Mon dossier » plus status with one; the first opens the dialog, the
  second links to `/carrier/application`; carrier and driver lists unchanged.
- `BottomNav`: the applicant slot's label and behaviour follow the
  application, in EN and FR.
- `ApplicationStatusBanner`: approved + no driver roles shows
  `approvedInactive`; approved + `carrier` shows the approved copy.
- Chromium: the reported click (Admin mode, admin sidebar, switcher row,
  dialog, primary button) lands on `/carrier/application` in user mode and
  stays there; both themes; EN and FR; 390 px.
