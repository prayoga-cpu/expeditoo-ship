# Spec — Postal Codes of 4, 5 or 6 Digits on a Job

**Status:** implemented 2026-09-30 (2.58.0).
**Plan:** `docs/plans/plan_client_feedback_postal_card.md`
**Amends:** `transport_listing_spec.md` §2 (endpoint `postalCode`),
`expedion_post_payment_fork_spec.md` (escalation blockers).

---

## 1. What this is

The client typed a Brussels address on `/create` (1000 BRUXELLES) and was told
*"Doit comporter 5 chiffres"*:

> About zipcode: 4, 5 or 6 numbers (not only 5)

Production's Expedion quotes agree. By delivery postal code, counted
2026-09-30: 3,796 have 5 digits, 317 have 4 (Austria, Belgium, Switzerland)
and 53 have 6 (Romania). A 4- or 6-digit code was normalised to `null`, which
blocked the quote from escalating and from direct assignment.

## 2. The rule

A job endpoint's postal code is **4 to 6 digits** — `JOB_POSTAL_CODE_PATTERN`
in `src/lib/postal-code.ts`, the one definition every job-side check reads:

| Where | Before | Now |
|---|---|---|
| `/create` form (`create/schemas.ts`) | `^\d{5}$` | `JOB_POSTAL_CODE_PATTERN` |
| `POST /api/listings` (`listings.dto.ts`) | `^\d{5}$` | same |
| Escalation (`normalisePostalCode`) | 5 digits after stripping, else `null` | 4–6 digits after stripping |
| Fix-form checklist (`quote-action.ts`) | 5 | 4–6 |
| Expedion report readiness (`expedion-report.dal.ts`) | `^[0-9]{5}$` | `^[0-9]{4,6}$` |

Message: *"Doit comporter 4 à 6 chiffres"* / *"Must be 4 to 6 digits"*.

Spaces are not accepted on `/create` (a French code is typed without them, and
so are Belgian, Swiss and Romanian ones). The escalation keeps stripping every
non-digit, as before.

## 3. What does not change

- **A driver's own address stays 5 digits** — KYC (`carrier.dto.ts`),
  in-house driver creation, trip declarations (`carrier-routes.dto.ts`) keep
  `POSTAL_CODE_PATTERN` from `french-identifiers.ts`. Those are French
  businesses with a SIRET.
- **The map stays France-only**: address search is restricted to France, a pin
  abroad reads *"Ce point est hors de France"*, and `listings.dto.ts` still
  bounds coordinates to metropolitan France + Corsica (a box that happens to
  include Belgium and Luxembourg). A foreign address is posted by typing it —
  the `address` mode, which carries no coordinates. Lifting that is a scope
  change (`ROADMAP.md` §9) and is left to the client.
- Codes with letters (UK, Netherlands, Canada) are still refused.

**What does change on the Expedion side, beyond the blocker.** The France
bound above is part of `createListingSchema`, which only `POST /api/listings`
parses. Escalation calls `listingsService.createListing` directly, so an
Expedion quote that delivers abroad **is published** once it has coordinates
and passes the ten checks. That was already true for 5-digit countries; this
rule extends it to 4- and 6-digit ones. On 2026-10-01 nothing in production
was affected: 2 of 4,658 quotes had delivery coordinates, neither abroad.

## 4. Test coverage required

- `/create` schema accepts 1000, 75011, 010011; refuses 123, 1234567, "75 011",
  "AB123"
- listing DTO: same cases
- escalation: a 4-digit and a 6-digit quote have no postal blocker and escalate
  with the digits; "L-1234" normalises to 1234; 3 and 7 digits still block
- quote-action mirror agrees with the service
