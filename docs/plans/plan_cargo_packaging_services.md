# Plan — Packaging services on /create, and one scrollbar

Spec: [`docs/specs/cargo_packaging_services_spec.md`](../specs/cargo_packaging_services_spec.md).

## The request

Client feedback, 2026-09-29, on a photo of `/create` step 1:

> There is a double scroll bar on the right and it's a little bit disappointing
> because it let think there is a problem of view on the website like a bottom
> white page instead form fields.

> Possible to add 2 fields: Need to be protected, Need to be packaged.

## Reading of it

1. **The scrollbar is a real bug, not a style complaint.** The app shells
   scroll inside `<main>`, which is not positioned. `OptionCard` (weight and
   size cards) hides its radio with `sr-only` — `position: absolute` — and no
   ancestor up to `<html>` is positioned, so those radios take the viewport as
   their containing block. They escape `<main>`'s overflow and stretch the
   document to wherever they sit, which adds a page scrollbar beside `<main>`'s
   own; scrolling it slides the `h-screen` shell up over blank space.
   Reproduced in Chromium on a minimal copy of the shell: 1661 px document in an
   800 px viewport, back to 800 px with `position: relative` on `<main>`.
2. **The two fields already half-exist, with the opposite meaning.** The last
   two toggles in his photo are `packagingLevel` — *Protégé* / *Emballé* — which
   record how the goods **already are** (`0027_packaging_level.sql`; the
   Expedion app asks « L'objet est-il déjà protégé ou emballé ? »). He is asking
   for a **service**: the carrier must protect / pack it. That changes what a
   carrier prices and whether they bring materials, so it is a new fact, not a
   relabel.

## Steps

1. **Shell** — `relative` on `<main>` in `MainLayout`, `DriverLayout`,
   `AdminLayout`; `relative` on `OptionCard`'s label so the card is correct in
   any container.
2. **Schema** — `0032_listing_packaging_services.sql`: `needs_protection`,
   `needs_packaging`, both `boolean NOT NULL DEFAULT false`, mirroring
   `is_fragile` / `needs_help`. Journal entry, `listings.ts`.
3. **Rule** — `src/lib/cargo-packaging.ts`: which service a stated packaging
   level already covers. Used by the DTO and by the form.
4. **Server** — `listings.dto.ts` (fields, `MATERIAL_FIELDS`,
   `PACKAGING_CONTRADICTION` on create), `listings.service.ts` (insert),
   `shipment.service.ts` (`DRIVER_LISTING_FIELDS`),
   `expedion-escalation.service.ts` (map `isProtected` to the real fields
   instead of `needsHelp`).
5. **Form** — `create/schemas.ts`, `useJobForm` defaults, `jobs.api.ts`
   payload; new `PackagingField` (state row + service row, kept coherent);
   `ToggleRow` moved to its own file so `PackagingField` can use it.
6. **Display** — `JobDetail` (relabelled state badge + two service badges),
   `JobCard`, driver shipment page; `Job` and `DriverShipment` types.
7. **Copy** — FR/EN: relabel the state pair *Déjà protégé* / *Déjà emballé*,
   add the group label and the two services on every surface.
8. **Tests** — rule, DTO, form schema, payload, `PackagingField`, service
   insert, escalation mapping, driver projection, board card.
9. **Release** — 2.55.0 · feat; CHANGELOG, STATUS (+ operator to-do for
   `0032`), `package.json`, `version.ts`; Chromium pass on the real `/create`.

## Dependencies

`0032` must run in production (**Actions → Migrate database**) before or with
the deploy: `createListing` writes both columns on every insert, so without
them every new transport request fails — the `0027` failure mode.
