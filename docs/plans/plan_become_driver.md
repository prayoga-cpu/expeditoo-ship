# Plan: Becoming a driver from the app shell

Spec: [`docs/specs/become_driver_spec.md`](../specs/become_driver_spec.md).
Reported 2026-10-07 with two screenshots: "Add carrier access" in the access
switcher did nothing, and the sidebar had no way to start an application or
see where one stands.

## Steps

1. **Leave admin mode on the way to the application.**
   `src/lib/use-application-nav.ts` — when the account cannot use Driver
   mode yet and is browsing as Admin, switch to the first non-admin mode
   before `router.push`, the same `setMode`-then-`push` shape
   `AdminLayout.handleBack` uses. Without it `MainLayout` bounces
   `/carrier/application` straight back to `/admin/expedion`.
2. **One onboarding dialog.** New
   `src/features/app/carrier/ui/DriverOnboardingDialog.tsx`, controlled
   (`open` / `onOpenChange`), reading `useCarrierApplication`. No application:
   three steps and « Commencer ma candidature ». An application: its status
   and « Ouvrir mon dossier ». Both buttons go through `useApplicationNav`.
3. **The switcher row opens the dialog.** `AccessSwitcher.tsx` — the row is
   renamed « Devenir chauffeur » (or « Mon dossier chauffeur » with the
   status once one exists), opens the dialog from `onSelect`, and the dialog
   is rendered beside the menu, not inside it.
4. **The sidebar gets its own entry.** `MainLayout.tsx` — user mode gains a
   green-accented entry above « Panneau d'administration »: « Devenir
   chauffeur » opening the dialog, or « Mon dossier » with a status pill
   linking to the page.
5. **The mobile bar agrees.** `BottomNav.tsx` — the applicant bar's existing
   « Mon dossier » slot reads « Devenir chauffeur » and opens the dialog until
   an application exists.
6. **Approved without access says so.** `ApplicationStatusBanner.tsx` — an
   `approved` application on an account holding neither `carrier` nor
   `driver` no longer claims « Vous êtes un chauffeur approuvé ».
7. **Copy.** `messages/{en,fr}.json`: `common.accessSwitcher.*`,
   `common.navigation.becomeDriver`, new `carrier.onboarding.*`,
   `carrier.application.banner.approvedInactive`. Spliced, not re-serialised.
8. **Tests**, per the spec's §8.
9. **Release 2.61.0**: CHANGELOG, STATUS, `package.json`, `version.ts`.

## Dependencies

None on the server: no route, service, DAL or migration changes. The
application status comes from the existing `GET /api/carrier/application`.

## Out of scope

- Restoring driver access to an account whose application is approved but
  whose roles were removed. That is an admin action (`/admin/users` role
  dialog, or re-approving the application, which re-runs
  `enrolAsOwnDriver`). The UI now says the access is inactive instead of
  claiming it is active.
- Making a single-mode account's badge a dropdown. The sidebar and mobile bar
  entries in steps 4 and 5 are its way in.
