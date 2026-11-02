# Plan — client feedback of 31 October 2026 (2.76.0)

Spec: `docs/specs/client_feedback_2026_10_31_spec.md`. Monitor: top of `STATUS.md`.
Source: ten WhatsApp messages forwarded on 31 October, about `/create`.

One release, one migration (`0045_request_form_feedback`). Built as 2.74.0 on
top of 2.73.1 and renumbered 2.76.0 when a parallel session's 2.75.0, which has
no migration, went to `main` first. There is no 2.74.0.

## Steps

| Step | Item | Files |
|---|---|---|
| 1 | Shared lists: location types, floor types, countries (patterns, boxes, names), job kinds, moving weight | `src/lib/location-types.ts`, `src/lib/countries.ts`, `src/lib/moving.ts`, `src/lib/cargo-packaging.ts` (`hasNoPackaging`) |
| 2 | Schema + migration | `src/db/schema/listings.ts`, `src/db/migrations/0045_request_form_feedback.sql`, `meta/_journal.json` |
| 3 | DTO + service + view | `listings.dto.ts`, `listings.service.ts` (`toColumns`, `flattenUpdate`), `listing-view.ts`, `expedion-escalation.service.ts` |
| 4 | Form schema, payload, resume | `create/schemas.ts`, `create/api/jobs.api.ts`, `create/from-listing.ts`, `create/hooks/useJobForm.tsx`, `app/(app)/(main)/create/page.tsx` |
| 5 | Form UI | `JobForm.tsx` (moving step, « Où » order, country, floors, labels), `PackagingField.tsx`, `SavedAddressPicker.tsx`, `address-book.ts`, `location-picker-field.tsx`, new `MovingFields.tsx`, `FloorFields.tsx`, `EstimateCard.tsx` |
| 6 | Estimate | `price-suggestion.ts`, `usePriceSuggestion.ts` |
| 7 | Display | `listing/types.ts`, `JobDetail.tsx`, `RequestSummary.tsx`, `home/ui/JobCard.tsx`, driver run page + `shipments.api.ts`, new `src/lib/endpoint-display.ts` |
| 8 | Profile address book | `AddressManagement.tsx`, `AddressForm.tsx` (`?for=`) |
| 9 | Copy | `messages/fr.json`, `messages/en.json` (spliced) |
| 10 | Tests, docs, release | tests per spec §9; CHANGELOG, STATUS, version, CLAUDE.md |

## Not in this release

- A rate per m³ for moves, and rates above 100 kg (the client's numbers).
- A « déménageur » carrier profile or a board filter by kind.
- Countries beyond the 14 of spec §0 A.
