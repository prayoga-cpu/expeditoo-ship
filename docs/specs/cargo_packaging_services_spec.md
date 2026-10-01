# Spec — Packaging services, and the state they sit beside

Plan: [`docs/plans/plan_cargo_packaging_services.md`](../plans/plan_cargo_packaging_services.md).
Extends `cargo_input_spec.md` (step 1 of `/create`) and
`transport_listing_spec.md` §"What".

## 1. Two different questions

| Question | Field | Values | Meaning |
|---|---|---|---|
| How is the item prepared? | `packagingLevel` (existing, `0027`) | `null` \| `protected` \| `boxed` | A **state** the requester reports. `null` = not stated. |
| What must the carrier do? | `needsProtection` (new) | bool, default `false` | The carrier protects the item (bubble wrap, blankets…). |
| | `needsPackaging` (new) | bool, default `false` | The carrier supplies a box and packs the item. |

The services are **independent** of each other: an item can need both.

`false` on a service means "not requested", which is the truth for every row
that predates the column, so both are `NOT NULL DEFAULT false` — unlike
`packagingLevel`, where absence must not be read as "unprotected".

## 2. Contradictions

A stated state already covers some services (`src/lib/cargo-packaging.ts`,
`isRedundantService`):

| `packagingLevel` | `needsProtection` | `needsPackaging` |
|---|---|---|
| `null` | allowed | allowed |
| `protected` | **redundant** | allowed — protected, still needs a box |
| `boxed` | **redundant** | **redundant** |

- **Form**: never produces a redundant pair. Turning a state on clears the
  services it covers; turning a service on clears a state that covers it. The
  last choice wins; nothing is refused.
- **`POST /api/listings`** (`createListingSchema`): a redundant pair is
  `400`, message `PACKAGING_CONTRADICTION`, path `packagingLevel`.
- **`PATCH /api/listings/:id`** is partial and is not cross-checked against
  the stored row (see §7).

## 3. Form (`/create` step 1, `PackagingField`)

Below Fragile / Help loading, a group labelled *Emballage* / *Packaging* with a
one-line hint, then four switch rows in a two-column grid from `sm` (one column
below it):

| | FR | EN |
|---|---|---|
| state | **Déjà protégé** — Vous l'avez protégé : film bulle, couverture… | **Already protected** — You've wrapped it: bubble wrap, blanket… |
| state | **Déjà emballé** — Vous l'avez protégé et mis en carton | **Already packaged** — You've wrapped it and put it in a box |
| service | **À protéger** — Le transporteur le protège : film bulle, couverture… | **Needs protection** — The carrier wraps it: bubble wrap, blankets… |
| service | **À emballer** — Le transporteur fournit le carton et l'emballe | **Needs packaging** — The carrier brings a box and packs it |

The two state rows stay mutually exclusive (one `packagingLevel`), as before.
All four are optional; none blocks "Next".

## 4. API

`createListingSchema` / `updateListingSchema` gain `needsProtection` and
`needsPackaging` (`z.boolean().default(false)`; no default under the partial
update). Both join `MATERIAL_FIELDS`: turning a service on or off after bids
changes what carriers priced, so live offers are invalidated the same way a
weight change invalidates them (`transport_listing_spec.md` §4).

`toCreatePayload` sends both booleans as they stand.

## 5. Display

| Surface | State (`packagingLevel`) | Services |
|---|---|---|
| `/listing/[id]` (`JobDetail`) | *Déjà protégé* / *Déjà emballé* badge | *À protéger*, *À emballer* badges |
| Board card (`JobCard`) | — (unchanged) | *À protéger*, *À emballer* badges |
| `/driver/shipments/[id]` | — (unchanged) | *À protéger*, *À emballer* badges |

Services go wherever `needsHelp` already goes, because they are the same kind
of fact: work the carrier does on site. `DRIVER_LISTING_FIELDS` gains both, so
the driver projection carries them; nothing commercial is added.

## 6. Expedion escalation

The Expedion quote carries one boolean, `isProtected`, set by the client app
from a three-way choice (unpacked / protected / packed), true for the last two.
It is a state. Escalation maps it:

| `quote.isProtected` | `packagingLevel` | `needsProtection` | `needsHelp` |
|---|---|---|---|
| `true` | `protected` (the lower bound of protected/packed) | `false` | `false` |
| `false` | `null` | `true` | `false` |

Before this spec `!isProtected` was written into `needsHelp` ("help loading"),
the only field that existed then. `needsPackaging` is never set by escalation;
the Expedion app does not ask it.

## 7. Known limits

- A `PATCH` that sets a service while the stored row holds a state that covers
  it is not refused. No UI edits a listing's cargo today.
- The Expedion app's three-way packing choice collapses to one boolean before
  it reaches this repo, so a packed lot reads *Déjà protégé*, not *Déjà emballé*.

## 8. Test coverage required

1. `isRedundantService` — the full §2 table.
2. DTO — both fields default `false`; each redundant pair is refused with
   `PACKAGING_CONTRADICTION`; `protected` + `needsPackaging` passes;
   `MATERIAL_FIELDS` includes both.
3. Form schema — both default `false`, both accept `true`.
4. `toCreatePayload` — carries both.
5. `PackagingField` — every label resolves in FR and EN; a state turned on
   clears the services it covers; a covering service turned on clears the
   state; `protected` + *À emballer* coexist; the two state rows stay exclusive.
6. `createListing` — writes both columns.
7. Escalation — both rows of the §6 table, `needsHelp` not derived.
8. Driver projection — carries both.
9. Board card — renders both badges, and neither when both are false.
