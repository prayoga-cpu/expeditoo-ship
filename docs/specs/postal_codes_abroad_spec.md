# Spec — Postal Codes of 4, 5 or 6 Digits on a Job

**Status:** implemented 2026-09-30 (2.58.0). §2–§3 describe that release;
the per-country format came with 2.76.0 (`client_feedback_2026_10_31_spec.md`
§6) and **every country of the world, in two tiers, with 2.94.0 — §5, which
is the current rule on `/create` and `POST /api/listings`.**
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

---

## 5. Every country and territory, in two tiers (2.94.0)

The client, 19 November 2026, under a photo of the fourteen-country list:

> In the country picking list, need to add all territories and countries of
> the world

for the pickup and for the delivery. `JOB_COUNTRIES` (`src/lib/countries.ts`)
is now the 249 officially assigned ISO 3166-1 alpha-2 codes — territories
included (RE, GP, MQ, NC, PR, HK…) — as a static array, because
`Intl.supportedValuesOf` lists no regions. Names are never copy: they come
from `Intl.DisplayNames` in the reader's language.

No migration: `listings.pickup_country` / `dropoff_country` are plain `text`
(default `FR`, no CHECK, no enum), and the postal code columns are `NOT NULL`
text, which take `''`.

### 5.1 The two tiers

| | **Detailed** — `FREQUENT_COUNTRIES` (FR MC BE LU NL DE CH AT IT ES PT PL CZ RO) | **Generic** — every other code |
|---|---|---|
| Postal code | **required**, the country's own pattern, example shown (« Ex. 1000 ») | **optional**; when given, 2–12 letters, digits, spaces or dashes, a letter or digit at each end; placeholder « Facultatif » |
| Stored when blank | — | `''` |
| Coordinates | inside the country's box (`isInCountry`) | no check — `isInCountry` answers true |
| Map | opens on the country's centre, held to its box (`maxBounds`) | no `maxBounds`; opens on the world, then on the country once it is looked up by name; moves freely |
| Refusals | `create.validation.postalCode` / `INVALID_POSTAL_CODE`, `outsideCountry` / `LOCATION_OUT_OF_COUNTRY` | `create.validation.postalCodeGeneric` / `INVALID_POSTAL_CODE` only |

Adding a country to the detailed tier is a row in `RULES` (pattern, example,
box, centre) and its code in `FREQUENT_COUNTRIES`.

**Only an absent country is France.** `rule()` used to fall back to France
for any code it did not know, so « US » was validated with five digits and
France's box. A generic code — or one nobody assigned — is never lent
France's pattern or box. The DTO still refuses a code outside `JOB_COUNTRIES`
(`UNSUPPORTED_COUNTRY`), lowercase and names included.

### 5.2 The picker

`CountrySelect` (`create/ui/CountrySelect.tsx`), one per end: a button that
reads as the form's other selects, opening a search box over a list. Nothing
typed: « Pays fréquents » (the fourteen, France first), then « Tous les
pays » (all 249 by name, collated in the locale). Typing narrows to names
containing the text — accents, case and punctuation aside — each country
once, with a country named outright first (« USA », « Angleterre », « jp »,
through `countryCodeFrom`). ↑ ↓ Home End move, Enter chooses, Escape closes;
the search box keeps the focus. Nothing matching says so and offers « Effacer
la recherche ». Changing the country still clears that end's address.

### 5.3 Searching the map

| Where | Country restriction |
|---|---|
| `/create` address search and pin (`LocationPickerField`) | the end's country — `geocoderScope` |
| Board / trip town search (`CityField`) | **none** — the whole world; a suggestion outside France still names its country |
| Request assistant, town lookup | the country the model named for that end, else none |
| Pins for a pin-less request (`listing-pins.service.ts`) | the end's own country; none when the caller knows no country. The restated `"fr,be,lu,…"` list is gone |
| Price suggestion (`usePriceSuggestion`) | the end's country |

**Territories.** Nominatim files a territory under the state it belongs to:
`countrycodes=re` finds nothing and a pin on Réunion reverse-geocodes as
`fr`. `geocoderScope(code, locale)` answers the `countrycodes` to use and,
for those territories, the territory's name to append to the query
(« Saint-Denis, La Réunion » with `countrycodes=fr`); a pin is in the country
when its reverse-geocoded code is that `countrycodes`. The table
(`GEOCODER_PARENT`: 12 under FR, 6 under US, 4 under NL, 4 under AU, HK and MO
under CN, BV and SJ under NO, AX under FI, EH under MA) was read from the
service itself, code by code, on 2026-11-22. It describes the geocoder's
data, nothing else.

### 5.4 The assistant

The model's `pickupCountry` / `dropoffCountry` is a nullable **string** in the
JSON schema (« ISO 3166-1 alpha-2 »), not an enum of 249 values. The service
reads it with `countryCodeFrom` — a code in either case, or a name — and
anything that is no country is null, which is France unless the map finds the
town elsewhere. `OTHER` and `outOfArea` (« Pays non desservi pour le moment »)
are gone: no country is out of area any more. The lookup is no longer
France-first: an unnamed town is searched world-wide once, and the map's own
ranking decides.

### 5.5 Reading a country's name

`countryCodeFrom` (escalated quotes' `delivery_country`, saved addresses'
`country`): every country's French and English name from `Intl.DisplayNames`,
built once, plus aliases the runtime does not know (« USA », « UK »,
« Angleterre », « Deutschland », « Hollande », « Hong Kong »…), then a
two-letter code **if it is assigned**. Unknown or blank is null — France for
both callers. The hand-kept `NAMES` table is gone.

### 5.6 Where a blank postal code is printed

`useEndpointText.town`, `stopLine` / `townLine` (`route-label.ts`) and the
assistant's reading all drop a blank code without a stray comma or bracket.
Saved addresses accept a blank `zip` (`addresses.dto.ts`) so an end typed
without one can still be kept.

## 6. Out of scope for 2.94.0

- **Customs, duties, carrier eligibility abroad.** A request to another
  continent can be posted; nothing checks that a road carrier can run it.
- **Price estimates far away.** The engine refuses beyond 1,000 km
  (`PRICING_CONFIG.maxDistance`), so « Prix conseillé » shows nothing rather
  than a road price to Tokyo. Unchanged.
- **Escalated quotes' postal codes.** ~~`normaliseJobPostalCode` still wants
  4–6 digits, so a quote delivering to « SW1A 1AA » keeps its postal
  blocker.~~ Done in 2.95.0 — §8.
- **Carrier trips, KYC and profile addresses** stay French (5 digits, search
  in France).

## 7. Test coverage required (2.94.0)

- `countries`: 249 unique two-letter codes containing the fourteen and US, GB,
  MA, SN, JP, RE, GP; a name for each in fr and en; detailed vs generic vs
  unassigned for postal code, box, bounds, centre, example — never France's;
  only an absent country is France; `countryCodeFrom` on names in both
  languages, aliases and unassigned codes; `countryOptions` order;
  `geocoderScope` for a state and a territory.
- form schema and listing DTO: postal code required in a detailed country,
  optional and loosely shaped in a generic one; an unassigned code refused; a
  pin anywhere in a generic country, still refused outside a detailed one.
- `CountrySelect`: closed state, the two groups, filter, alias first, click,
  keyboard, nothing found, search forgotten on close.
- `LocationPickerField`: bounds for a detailed country, none for a generic
  one, opening lookup, search scope, pin accepted / refused, a territory.
- `CityField`: no country restriction. `listing-pins`: own country, none, a
  territory.
- assistant: far country found and named, any-shape postal code kept, blank
  where there is none, lenient reading of the country, no country list in the
  JSON schema, a territory.
- escalation: delivery country from any French or English name; unassigned →
  France.

## 8. Escalated quotes follow the delivery country (2.95.0)

A paid quote delivering outside the fourteen detailed countries could never be
published: `escalationBlockers` ran `normaliseJobPostalCode` on the delivery
code, so « SW1A 1AA » (two digits once the letters are stripped) and a Hong
Kong address with no code at all both read « delivery postal code » missing.

`quotePostalCodeFor(country, value)` in `src/lib/postal-code.ts` is the one
rule, and it writes no pattern of its own:

| Delivery country (`quoteDeliveryCountry`, blank or unrecognised → FR) | Postal code |
|---|---|
| detailed (`isPostalCodeRequired`) — the fourteen | `normaliseJobPostalCode`: 4–6 digits after stripping, else blocked. Unchanged. |
| any other | trimmed and kept as written when `isValidPostalCode` accepts it; `''` when absent; blocked only when it is not shaped like a postal code |

- The **pickup** is unchanged: an auction house, strict 4–6 digits.
- `escalationBlockers` (service) and `draftEscalationBlockers`
  (`quote-action.ts`, the admin checklist) both call the helper, so the
  « postal code missing » blocker and Publish agree. `EscalationDraft` gained
  `deliveryCountry`.
- The value handed to `createListing` is the helper's, so the listing stores
  « SW1A 1AA » or `''` exactly as `/create` would.

Tests: `expedion-escalation.escalate.test.ts` (UK code kept as written, a
country with no codes stored as `''`, a malformed code still blocked, strict
rule kept for France / Belgium / blank country, pickup never loosened);
`quote-action.test.ts` (the same five on the draft).
