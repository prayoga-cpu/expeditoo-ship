# Plan — /create feedback of 2026-10-02 (2.59.0)

Three reports from the client (mat nicolas, FR, v2.58.0, `/create`):

| Ref | Report |
|---|---|
| `#XBYUSQ2D` | "LAST PAGE FORM: create a landing page of thanks to register the ask for shipment on website" (reference: Cocolis' « Félicitations ! … Voir mon annonce / Déposer une autre annonce ») |
| `#5-FSXWN_` | "FORM PAGE3: below the two lines of the date (pickup and delivery), put horizontally names of days of the week with checkbox already checked. About availability, add possible to morning and afternoon (and also evening): not only one" |
| WhatsApp | "When I click on the button register (left of publish), there is a message on the right bottom of the page (has to be changed: warning about dates of pickup and publish too close)" — the toast read « Le retrait est trop proche pour laisser le temps d'enchérir. Reportez-le. » |

Specs:

- `docs/specs/publication_timing_spec.md` — the draft refusal, the warning, and
  the form's error handling (report 3).
- `docs/specs/request_availability_spec.md` — weekdays and several times of
  day (report 2).
- `docs/specs/request_posted_page_spec.md` — the thank-you page (report 1).

## Root causes found

1. **A draft was refused by a publication rule.** `createListing` skips
   `PICKUP_IN_PAST` for a draft ("a draft may sit unposted") but still calls
   `resolveExpiresAt`, which throws `PICKUP_TOO_SOON` for the same date. A test
   pinned it "rather than endorsing it" (2.25.1).
2. **A flexible range starting today was always in the past.** "Du 02/10, Matin"
   resolved to 02/10 06:00; "N'importe quand" to 00:00. Any flexible request
   starting today was unpublishable once that hour passed. The date picker
   allows today.
3. **The When step's date rules never ran.** `budgetEuros` has no default, so
   Zod aborts on `NaN` before the root `superRefine`; "Suivant" on step 3 always
   passed. On step 4 the same errors sat on fields that are not on screen and
   `handleSubmit` had no invalid handler, so "Publier" and "Enregistrer le
   brouillon" could silently do nothing.
4. **Nothing on the client knew the publication rule.** Too-soon pickups were
   only discovered by the server, reported as a 4-second corner toast on step 4
   about a value chosen on step 3. `PICKUP_IN_PAST` had no message at all
   (generic « Impossible de publier… réessayez »), and a schedule less than
   30 minutes before pickup passed the client and failed the server.
5. **The form could hold only one time of day and no weekdays,** and the four
   window instants it posts cannot express "Monday–Friday, mornings and
   evenings". The French subtitle already promised « jours de la semaine et
   tranches horaires ».
6. **There was no page after publishing:** a toast and `/home`.
   `transport_request_spec.md` had chosen "no success page" when the only one
   available was the goods-auction leftover.

## Steps (in order)

1. **Shared rule** — `src/lib/listing-window.ts`: `publicationProblem`,
   `earliestPickupFor`. Pure, used by the form and the service.
2. **Server** — `listings.service.ts` `createListing`: every publication check
   (`PICKUP_IN_PAST`, `SCHEDULED_PUBLISH_IN_PAST`, `PICKUP_TOO_SOON`) only when
   `publish`; a draft stores `expiresAtFor(pickupFrom, now) ?? pickupFrom` and
   no schedule. Flip the pinned test.
3. **Availability storage** — migration `0035_listing_availability.sql`
   (four jsonb columns, defaults = unrestricted), Drizzle schema, DTO
   (validation + `AVAILABILITY_REQUIRES_FLEXIBLE`), `toInsert`,
   `MATERIAL_FIELDS` (+ the missing `isFlexible`), `Job` type.
4. **Timing model** — `timing.ts`: flexible endpoints carry `days` + `periods`;
   the window is derived from the allowed (day, period) intervals and starts at
   the first one still usable (`now` + 30 min + margin, half-hour aligned);
   delivery starts no earlier than pickup.
5. **Form** — `TimingField.tsx` (weekday row, multi-select periods, inline
   publication error/warning), `PublishTimingField.tsx` (schedule problems),
   `schemas.ts` (publication rules out, `noAllowedDay` in, seeded budget),
   `useJobForm.tsx` (re-resolve at submit, gate Publish, invalid handler,
   server-code mapping, draft never gated), `jobs.api.ts` (payload).
6. **Display** — `RequestSummary`, `JobDetail` `Endpoint`, `SubmitOfferForm`:
   one availability line when restricted.
7. **Thank-you page** — `/create/success/[id]` + `RequestPostedScreen`;
   `useJobForm` routes there with `replace` after a publish or schedule,
   invalidates `my-jobs`, keeps its buttons disabled once it has succeeded.
8. **Copy** — FR + EN (`create.when.*`, `create.publication.*`,
   `create.success.*`, `create.toast.*`), parity by key diff.
9. **Tests**, gates, a Chromium pass (Europe/Paris, FR + EN, light + dark),
   release 2.59.0, migrate production from `release/2.59.0`, then `main`.

## Dependencies and risks

- **Migration before deploy.** New code selects the four columns; production
  must run `0035` (Actions → Migrate database, dispatched on the release
  branch) before `main` moves.
- **No change to the bidding deadline rule** (`expiresAtFor`). Its 6 h–6 h 30
  band can give under 30 minutes of bidding, and re-boarding is tested against
  that exact behaviour (`offers.service.test.ts`, "refuses to re-board into a
  window too short to bid in"). The warning shows the real deadline instead.
- **Out of scope, found on the way** — recorded in STATUS "Known limits":
  drafts cannot be published, edited or deleted by their author; `GET
  /api/listings[/:id]` returns the full `user` row of the requester; the chat
  offer form gates days but not periods; the opening chat line formats dates in
  UTC; `upcomingOccurrences` steps 24 h across DST.
