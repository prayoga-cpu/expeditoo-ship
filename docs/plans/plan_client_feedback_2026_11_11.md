# Plan — Nicolas's remaining tickets (2.83.0)

Spec: `docs/specs/client_feedback_2026_11_11_spec.md`.

1. **Migration 0047** (hand-written, journal `when` 1788865200000 > 0046's): A01 four text columns, A07 one,
   C02 two on `carriers`. Additive and nullable — old code tolerates the new columns.
2. **B03** `carrier-routes.dto.ts`, `carrier-routes.service.ts` (`withPins`), `TripRouteFormDialog.tsx`, `OfferSlotsField.tsx`.
3. **B05** `carrier-missing-documents.ts`, `MissingDocumentsEmail.tsx`, `email.service.ts`, `carrier.service.ts`.
4. **A01** schema → DTO → service → `listing-view` → form schema / payload / resume → `TimingField` → display.
5. **C02** schema + relation → service → route → hook → `ContactConfirmedField`.
6. **A07** `illustrations.ts`, four SVGs, DTO/service/view, `IllustrationField`, `IllustrationImage`.
7. **U04** `Profile.tsx`; **U01** marketing page.
8. Release record in four places; two stale STATUS lines fixed.

Order on production: **run Migrate database from the release branch, then let `main` deploy.**
