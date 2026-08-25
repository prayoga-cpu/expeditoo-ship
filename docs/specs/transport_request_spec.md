# Spec — Direct Transport Request

**Brief ref:** `audit+expectation.pdf` item 3 — "Add a new page where users can
request transportation for any object/item. The request should include all
necessary information about the object, pickup location and delivery location."

**Plan:** `docs/plans/plan_brief_items_2_3.md`

**Status:** implemented 2026-08-26. Restores a surface deleted in `7a455c0`.

---

## 1. What this is

A signed-in person describes something they need moved and two addresses. That
becomes a `listings` row with `origin = 'direct'`, open to bids from approved
carriers. The requester compares offers and accepts one.

This is the **second** inlet. Expedion escalation is the other. They produce the
same kind of row and differ in exactly one respect — who is allowed to award.

| | Expedion escalation | Direct request |
|---|---|---|
| Owner (`shipperId`) | `EXPEDION_SYSTEM_USER_ID` | the requester |
| `origin` | `expedion` | `direct` |
| Who awards | an **operator** (`/admin/awards`) | the **requester** |
| Money at post time | already paid to Expedion | **none** — see §6 |

---

## 2. Route and permissions

| Route | Who | Behaviour |
|---|---|---|
| `/create` | any session | The four-step request form |
| `/listings/me` | any session | The requester's own requests, any status |
| `POST /api/listings` | any session | Creates the row. **No role check** — posting needs no vetting |
| `GET /api/listings/me` | any session | The caller's own rows only |

`/listings/me` previously redirected to `/expedion`. It no longer does: a draft
saved from `/create` lands there, and a request nobody can find again is not a
request.

---

## 3. The form

Four steps, each validated on its own so a person is never blocked by a field on
a screen they have not reached. `STEP_FIELDS` in `schemas.ts` is the mapping.

1. **What** — title, description, weight, quantity, optional L/W/H, fragile and
   help-loading toggles, up to 5 photos.
2. **Where** — pickup and delivery, each through the shared
   `LocationPickerField` (Nominatim search, draggable pin, reverse geocode),
   plus a location type. An **apartment** must also state floor and lift.
3. **When** — pickup and delivery windows, and a flexibility toggle.
4. **Budget** — what the requester expects to pay, in euros.

### Deliberate omissions

- **No category picker.** A person describing a wardrobe should not have to file
  it into a taxonomy. `categoryId` is optional on the DTO and the service
  resolves a default (§4).
- **No `origin` field.** Stamped by the service. See §5.
- **No success page.** The restored one was written for the v1 goods auction
  ("Auction Created Successfully!"). Publishing now routes to
  `/listing/{id}` — the thing that was just created — and saving a draft routes
  to `/listings/me`.

---

## 4. Category resolution

`listings.category_id` is a non-null foreign key, so a request with no category
cannot be inserted. `listingsDal.ensureDefaultCategory()` upserts a stable
`transport-general` row and returns its id. Upsert rather than lookup because an
environment whose seed predates that row would otherwise fail the insert, which
reads as "posting is broken" rather than "this database has no categories".

An explicit `categoryId` from an internal caller is still honoured.

---

## 5. `origin` is a server-side stamp — do not make it an input

`offersService.acceptOffer` decides whether an **operator** may award a job in
the owner's place by reading `listing.origin`. If `origin` were a field on
`createListingSchema`, any signed-in account could post work directly into the
operator award queue and have staff award it.

So: `toInsert` writes `origin: "direct"` unconditionally, and escalation stamps
`"expedion"` on its own listings from its own service. Neither value ever
crosses the API boundary from a client.

---

## 6. What this does **not** do — money

A direct request has **no payment behind it**. An Expedion job arrives already
paid for, and `budgetCents` is what the client paid. On a direct request
`budgetCents` is only an expectation.

Accepting an offer on a direct request runs the same hold-then-capture path,
which is currently behind `MOCK_PAYMENTS`. **Direct requests must not be taken
live until real Stripe hold/capture exists** (`ROADMAP.md` §10.1 and the
`TODO(EXPEDITOO-TESTING)` markers). This is a known, deliberate gap, not an
oversight — flagged to the client on 2026-08-26.

---

## 7. Validation

The client mirror in `src/features/app/create/schemas.ts` copies the server
rules in `listings.dto.ts`, including two the old mirror omitted and so let the
form submit work the API then rejected:

- **France bounds** on both endpoints (`LOCATION_OUT_OF_COUNTRY`)
- **Minimum 500 m** between pickup and delivery (`PICKUP_DROPOFF_TOO_CLOSE`)

Also fixed in the restoration:

| Was | Now |
|---|---|
| `z.coerce.number()` read an emptied field as `0`, failing `.positive()` with a message about zero | blank preprocesses to `undefined`, so `.optional()` means what it says |
| `z.coerce.date()` typed its own *input* as `Date`, so the four `datetime-local` fields rendered blank | `z.string().pipe(z.coerce.date())`, seeded with `YYYY-MM-DDTHH:mm` |
| An invisible, ungated `data-testid="test-upload-bypass"` button injected a data-URI photo for anyone who found it | removed |
| The photo remove button had no `type`, so it submitted the form | `type="button"` |

Validation messages are **translation keys** (`create.validation.*`), resolved
by `FieldError`. A Zod schema cannot call `useTranslations`, and the alternative
is a form that validates in one language.

---

## 8. Visibility to drivers

The board at `/expedion` was pinned to `origin: "expedion"` and would have
hidden every direct request. The pin is removed — it is now the board of all
open jobs, whichever inlet they came from, which is also what brief item 5 asks
for ("all available shipping requests"). `JobBoard` keeps its `origin` prop, so
re-separating the two inlets is a one-word change.

The driver dashboard's open-jobs count is unpinned to match, so the number a
driver reads agrees with what the board shows.

---

## 9. Test coverage required

- [x] `writableFields` — null filtering and the atomic name pair (6 tests)
- [x] `parseFrenchName` — 26 cases (see `french_name_parsing` in the plan)
- [ ] `createListing` stamps `origin: "direct"` regardless of any client input
- [ ] `createListing` resolves a category when none is given
- [ ] Client mirror rejects out-of-France and sub-500 m routes
- [ ] E2E: post a request → it appears on the board → a carrier bids

The unchecked items are **not yet written**. They are the gap between this spec
and the code as it stands.
