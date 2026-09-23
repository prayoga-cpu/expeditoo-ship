# Plan: beta data seed for the owner account

**Request:** _"I need you to write data on the database … for all of those
transactions … at least 1 transaction from my account on every role's side …
as beta test to run."_

**Constraint that shapes everything:** a laptop has no write path to
production, by design (`docs/specs/environments_spec.md`). The only place the
production connection string exists is the repository's Secrets, read by
`.github/workflows/migrate.yml`. So the seed runs the same way a migration
does — a `workflow_dispatch` job — and the code it runs is the app's own
services and DALs, never hand-written SQL.

## Steps

1. `src/scripts/beta-fixtures.ts` — pure data, every service-bound fixture
   parsed through that service's Zod schema. Unit-tested.
2. `src/scripts/seed-beta-data.ts` — the runner. Target gate mirrors
   `migrate.ts` (`SEED_TARGET=production` opt-in, `assertDevelopmentDatabase`
   otherwise); requires `MOCK_PAYMENTS=true`; imports `@/db` only after the
   connection string is normalised.
3. `.github/workflows/seed-beta.yml` — copy of `migrate.yml`'s shape with
   `APP_ENV=production`, `SEED_TARGET=production`, `MOCK_PAYMENTS=true`, and
   **no** Stripe / Resend / Twilio / Ably / R2 key.
4. `package.json` — `db:seed:beta`.
5. Rehearse against the local database with the three account emails
   overridden, read every table the run touched, then dispatch against
   production and verify through the public read endpoints.

## Files

| File | Role |
|---|---|
| `src/scripts/beta-fixtures.ts` | fixtures, `isValidSiret`, date helpers |
| `src/scripts/seed-beta-data.ts` | runner |
| `src/scripts/__tests__/beta-fixtures.test.ts` | fixture coverage |
| `.github/workflows/seed-beta.yml` | the production entry point |
| `docs/specs/beta_seed_spec.md` | the contract |

## Dependencies

- Migrations through `0031` applied to the target (`migrate.yml` first).
- The three accounts exist: the seed never creates people.
- `listingsService.createListing`, `offersService.submitOffer` /
  `acceptOffer`, `shipmentService.updateStatus`, `carrierService.approve`,
  `carrierRoutesService.create`, `reviewsService.createReview` — all called as
  the routes call them.
