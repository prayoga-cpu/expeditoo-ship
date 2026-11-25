# Plan — client feedback of 25 November 2026 (2.99.0)

Specs: `docs/specs/client_feedback_2026_11_25_spec.md`,
`docs/specs/first_paint_language_spec.md`.

1. Icon: `Gavel` → `HandCoins` on every offers surface except the operator queue.
2. `LocationPickerField`: search pick writes the hit's address; pins replace
   pin-written text; typed text survives a nudge. `SearchResult` gains
   street/city/postalCode.
3. Copy: hero badge (« Transport partagé… »), « vérifiés » removed everywhere
   (catalogues, page metadata, welcome mail) — one script over both catalogues.
4. Hero: badge moved to a centred row above the two columns, larger.
5. Language: `resolveRequestLocale` + `getRequestLocale`; root layout async;
   `Providers locale` → `LocaleProvider initialLocale`; cookie written with the
   choice, localStorage migrated.
6. Logo: `AppSidebarHeader` default `/`, shell overrides removed, phone wordmark.
7. Tests, gates, browser check (SSR language by header, hero at 1440 and 390),
   release record (CHANGELOG ×2, STATUS, package.json, version.ts).
