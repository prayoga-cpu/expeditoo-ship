# Plan — Type the Address or Paste a Google Maps Link

**Spec:** `docs/specs/location_link_entry_spec.md`
**Request (2026-09-24):** "if user switch to input address manually instead of
the map pin, give 2 options: 1. either full address type 2. or gmaps link,
with note"

## Steps

1. **`src/components/ui/location-picker-field.tsx`** — widen the local mode
   from `assisted | manual` to `LocationPickerMode` (`assisted | address |
   link`); add optional controlled `mode` / `onModeChange`; render a
   `ToggleGroup` switch in manual mode; in link mode reuse the existing
   link-resolving state (`linkValue`, `handleUseLink`, `setPin`), show the
   how-to, then a confirmation row with a Google Maps check link; hide the
   fields until a link has resolved; leave them unlocked in link mode.
2. **`src/features/app/create/schemas.ts`** — client-only
   `locationEntry` on `endpointSchema`; two `superRefine` rules
   (`mapLinkRequired` on `lat`, `linkNoteRequired` on `note`).
3. **`src/features/app/create/api/jobs.api.ts`** — strip `locationEntry` in
   `stripAddressMeta`.
4. **`src/features/app/create/ui/JobForm.tsx`** — pass `mode` /
   `onModeChange` through form state; reset `locationEntry` when a saved
   address is applied or cleared; swap the address errors for the link error
   while a link has not resolved; relabel the note and make it required in
   link mode; re-validate city/postcode/note only while they show an error.
5. **`messages/en.json`, `messages/fr.json`** — picker, note and validation
   strings; parity checked by key diff.
6. **Tests** — schema rules, payload stripping, and a component test for the
   picker in manual mode (map, geocoding and Lottie mocked).
7. **Verify** in Chromium against the dev server with a throwaway account.

## Dependencies

None new. `resolveMapLink`, `POST /api/geo/resolve-map-link`, `setPin` and
`ToggleGroup` already exist. No migration: the API contract is unchanged.
