# Spec — Type the Address or Paste a Google Maps Link

**Status:** implemented 2026-09-24 (2.54.0).
**Plan:** `docs/plans/plan_location_link_entry.md`
**Extends:** `transport_request_spec.md` §3 step 2 (Where), and the
`allowManualOnly` mode of `LocationPickerField` added in 2.50.0.

---

## 1. What this is

On `/create`, each endpoint (pickup, delivery) has a map. Someone who cannot
find their place on it clicks **"Can't find it?"** and leaves the map. Until
now that led to one thing: typing the address by hand, with no pin.

The requester asked for two ways in once the map is left:

1. **Type the full address** — unchanged from 2.50.0.
2. **Paste a Google Maps link, with a note** — for a place that has no
   usable street address (a field gate on a departmental road, a barn, a
   loading bay). The link supplies the exact point; the note tells the carrier
   what to look for there.

Only `/create` turns this on. The trip dialog and the admin Expedion dialog
do not pass `allowManualOnly` and behave exactly as before.

---

## 2. Modes

`LocationPickerMode` = `"assisted" | "address" | "link"`.

| Mode | Shown | Pin | Text fields |
|---|---|---|---|
| `assisted` | map + search + "Can't find it?" | from search, click or drag | locked once pinned |
| `address` | "Use the map instead" + a two-option switch + the fields | none | editable |
| `link` | "Use the map instead" + the switch + the link box; the fields only once the link has resolved | from the link | editable |

The switch reads **Type the address** / **Google Maps link** (FR: *Saisir
l'adresse* / *Lien Google Maps*). "Can't find it?" opens `address`.

### 2.1 What switching does to the value

| From → to | Text | Pin |
|---|---|---|
| `assisted` → `address` | kept (a starting point to correct) | dropped |
| any → `link` | cleared | cleared |
| `link` → `address` | kept | dropped |
| any → `assisted` | cleared | cleared |

This is the 2.50.0 rule carried over: typing starts from whatever text is
there, and the map and the link start clean so the text they fill in is never
left over from another mode. Every switch also clears the link box, its error
and any location error.

### 2.2 Why the fields stay editable in link mode

A map pin in `assisted` mode locks the fields, since the map just supplied them
(a rule the client asked for in 2.50.0). A link in `link` mode does **not**:
the person pasting one left the map because its address was not good enough,
and reverse geocoding is a best guess (on the test point it answered "Rue du
Château" for a spot on the D43).

---

## 3. Link mode behaviour

1. The box shows the label *Google Maps link*, the input, **Use link**, and a
   one-line how-to: *In Google Maps, press and hold the spot, tap Share, then
   Copy link.* No Cancel button — the switch is the way out.
2. **Use link** (or Enter) calls `resolveMapLink`: a full link is parsed in the
   browser; a short `maps.app.goo.gl` link goes through
   `POST /api/geo/resolve-map-link` (session, host allowlist, rate limit — all
   unchanged). Apple Maps, Bing, Waze and OpenStreetMap links still work; the
   label says Google because that is what people have.
3. On a point: `setPin` reverse-geocodes it, refuses a point outside France
   (*This point is outside France*), and fills **only blank** fields — the same
   code path as the map.
4. Once pinned, the box becomes a confirmation row: *Location found from the
   link* · **Check it on Google Maps** (opens
   `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` in a new tab —
   with no map on screen, this is how the point gets checked) · **Use another
   link** (back to an empty link box). Under it: *Filled in from the link —
   correct it if needed*, or the location error when reverse geocoding found no
   address.
5. On failure the link **stays in the input** and the error says why:
   `UNSUPPORTED_LINK_PROVIDER` → *We don't recognise that link…*; anything else
   → *Couldn't find a location in that link…*.

---

## 4. The note

In link mode the endpoint's existing carrier note (`pickup.note` /
`dropoff.note`, the column carriers already read on the shipment screen)
becomes **required**, relabelled *Describe the exact spot* with the placeholder
*e.g. Blue gate on the left, 200 m after the church*. In `address` and
`assisted` modes it stays *Note for the carrier (optional)*.

---

## 5. Validation (`endpointSchema`, client only)

`locationEntry` is a client-only field on the endpoint, like `saveAddress`: it
lets the mode survive the Where step unmounting and lets the schema read it.
`toCreatePayload` strips it; the API never sees it.

| Condition | Message key | Path |
|---|---|---|
| `locationEntry = "link"` and no `lat`/`lng` | `create.validation.mapLinkRequired` — *Paste the link, then press Use link* | `lat` |
| `locationEntry = "link"` and `note` blank after trim | `create.validation.linkNoteRequired` — *Tell the carrier what to look for at this spot* | `note` |

While a link has not resolved, the form shows the `lat` message **instead of**
the address/city/postcode messages — those describe fields this mode has not
shown yet.

Errors on the form:
- are raised by "Next", not by opening a mode (a pin's `lat`/`lng` is
  re-validated only when one arrives);
- are cleared for `lat` and `note` on every mode switch;
- clear for `city`, `postalCode` and `note` as soon as the value that fixes
  them arrives. The city/postcode half fixes a bug older than this feature: a
  pin or link that filled them left the earlier "City is required" / "Must be
  5 digits" on screen until the next "Next".

---

## 6. What does not change

- **The API contract.** A place given as a link reaches `POST /api/listings`
  as `lat`, `lng`, `address`, `city`, `postalCode` and `note` — the same shape
  as a map pin with a note. No column, no migration, no DTO change.
- **The link itself is not stored.** The coordinates are the fact; the link
  was only a way to enter them.
- **Awarding.** `offersService` refuses to award a listing with no coordinates
  (`COORDINATES_REQUIRED`, 2.50.0). A typed address still has none; a link
  does, so a link-located job is awardable.
- **Driver navigation** still routes to the text address
  (`ShipmentActions`' `NavigateButton`), not the pin. The route map on the
  driver's shipment screen does show the pin. See Known limits in `STATUS.md`
  2.54.0.

---

## 7. Test coverage required

- [x] Link mode without a resolved point → `mapLinkRequired`
      (`create/__tests__/schemas.test.ts`)
- [x] Link mode with a blank note → `linkNoteRequired`
- [x] Link mode with a point and a note passes
- [x] `address` mode leaves the note optional
- [x] `locationEntry` never reaches the payload; the point and note do
      (`create/__tests__/jobs.api.test.ts`)
- [x] The switch offers both options, typing first
      (`components/ui/__tests__/location-picker-field.test.tsx`)
- [x] Link mode hides the fields until the link resolves and shows the how-to
- [x] A resolved link sets the pin, fills the fields, leaves them editable,
      and links to the point on Google Maps
- [x] A link that cannot be read keeps the pasted text and says why
- [x] Link → address keeps the text and drops the pin
- [x] Chromium, against the dev server: both modes, the "Next" errors, the
      found state, light/EN and dark/FR
- [ ] A full `/create` submit with a link-located endpoint, driven end to end
