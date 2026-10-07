# Plan — saved addresses on « Où » and the profile (2.62.0)

Contract: `docs/specs/saved_addresses_spec.md`.

1. `src/lib/saved-address.ts`: `ADDRESS_SIDES`, label presets, legacy-key
   reading, display name.
2. Migration `0037_address_used_for` (+ journal) and the Drizzle column; DTO
   `usedFor`; service create writes it.
3. `create/address-book.ts`: `matchSavedAddress`, `autoPickAddresses`.
   `create/schemas.ts`: `sameEndpoint` and the `sameAddress` rule.
4. `useJobForm`: pre-fill once (`prefillAddresses`), toast the same-address
   refusal on « Suivant », save with `usedFor` and a preset label.
5. `JobForm` « Où »: one address-book read in `WhereStep`; `SavedAddressPicker`
   as a `Select`; the delivery error shown in both branches and live; the
   label presets on « Enregistrer ».
6. Profile: `AddressLabelField` shared by `AddressForm` and `/create`;
   `AddressForm` writes ids and `usedFor`; the profile card lists every
   address; `AddressManagement` translated, with names and badges.
7. Copy FR/EN (keys spliced in, not rewritten); tests per spec §7.
8. Production runs `0037` before the deploy (Actions → Migrate database).

Depends on nothing in flight. Shares `messages/*.json` and the four release
files with the concurrent 2.61.0 session (driver onboarding), which has no
migration.
