# Nicolas's feedback of 4–6 November — the remaining tickets (2.83.0)

Source: `[EXPEDITOO] Open Tickets with Suggested Answers, 11.11.2026.pdf`. Every default below is an
**assumption, not a client decision** (see STATUS.md, « Decisions taken without the client »).
Earlier part: `client_feedback_2026_11_06_spec.md` (2.80.0).

## B03 — a trip by town and postcode

| Rule | Behaviour | Error |
|---|---|---|
| Endpoint | `address` optional (default `""`); `city` and `postalCode` required; `lat`/`lng` optional | `INVALID_POSTAL_CODE` |
| Pin | sent by the map, else looked up by `locate()` (street + postcode + town, then postcode + town, then town; `fr` when the country is France) | `ROUTE_LOCATION_NOT_FOUND` 422 when nothing is found — no trip is stored without coordinates |
| Dialog | « Créer » unlocks on town + postcode at both ends and a weekday / a date; a line under the button names what is missing | — |
| Offer calendar | footer also prints the job's window when it is not flexible | — |

Tests: `carrier-routes.service.test.ts` (4 new), `tripFormMissing.test.ts`.

## B05 — missing documents

On `submitApplication`, after the admin alert: required kinds (`REQUIRED_DOCUMENT_KINDS`) minus uploaded ones.
Non-empty → email (`MissingDocumentsEmail`, FR then EN, from the configured sender) **and** an in-app
notification (`carrier_documents_missing`); empty → nothing. Best-effort: a failure never fails the submission.
Not sent on each later upload (spam); only at (re)submission. Tests: `carrier-availability.service.test.ts`.

## A01 — exact hours (migration 0047)

`listings.pickup_time_from/to`, `dropoff_time_from/to`: `text`, « HH:MM », nullable. A pair or nothing
(`TIME_WINDOW_INCOMPLETE`), end after start (`TIME_WINDOW_ORDER`), clock format (`INVALID_TIME`). Part of
`MATERIAL_FIELDS` (a carrier prices on them). Periods stay and are not replaced. Shown by `AvailabilityLine`
(job page, summary, offer form). Tests: `listing-time-windows.test.ts`.

## C02 — « Contact confirmé » (migration 0047)

`carriers.contact_confirmed_at` + `contact_confirmed_by` (→ `user.id`, set null). `carrierService.setContactConfirmed`:
admin or operator only (`FORBIDDEN_ROLE` 403), `CARRIER_NOT_FOUND` 404. Patches only those two columns — approval is
untouched. `PUT /api/admin/carriers/:id/contact-confirmed {confirmed}`. **Auto-approval is not built** (every driver
carries goods for hire; « individual » is undefined — `carriers.kind` is « professional » for all).

## A07 — illustration (migration 0047)

`listings.illustration` ∈ furniture | parcel | pallet | vehicle | null. Never defaulted. Refused beside a photo
(`ILLUSTRATION_WITH_PHOTOS`). `/create`: offered when there is no photo and a title; a tick is required; adding a
photo withdraws it. Labelled « Illustration » on the board card and the job page. **Not covered:** the message-thread
header image. No AI image generation.

## U01 — homepage

Navbar, hero, three steps, two reasons (return legs, bank transfer), one closing button, footer. Removed from the
page (components kept): cross-sell banner, job-board preview, platform tour, testimonials. Hero: step strip removed;
bid card and stats hidden below `lg`. « Verified in 24 hours » replaced.

## U04 — profile in five parts

Identité · Contact · Adresses · Chauffeur (drivers and applicants only) · Compte. `quickLinkGroups` decides the
links; every pre-existing link is kept. Admin and driver profile routes keep their own link sets.

## Test coverage required

The suites named above, plus `Profile.test.tsx` (`quickLinkGroups`) and `LandingSessionCtas.test.tsx`.
