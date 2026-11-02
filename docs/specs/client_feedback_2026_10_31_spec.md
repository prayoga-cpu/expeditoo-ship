# Client feedback of 31 October 2026 — the request form — spec

Status: **current** (2.76.0 onwards). Plan:
`docs/plans/plan_client_feedback_2026_10_31.md`. Monitor: the top of
`STATUS.md`, one row per item.

The client forwarded ten WhatsApp messages about `/create`, seven of them with
screenshots of Cocolis (their reference) and one of our own « Type de lieu »
select. Eight asks:

| # | The client's words | Ask |
|---|---|---|
| F1 | « Il faut créer un répertoire d'adresses pour les adresses de départ et également pour les adresses d'arrivée » | An address book per end |
| F2 | « Il faut ajouter également un lien pour effectuer un devis Déménagement » + Cocolis « Description du déménagement » | A moving request |
| F3 | « Et adresse de livraison avec mention des étages » | Floors |
| F4 | « Estimation de prix » (Cocolis: 857 € and four steps) | A price estimate |
| F5 | « Dans la rubrique emballage … rajouter une coche (automatiquement cochée) … Ni protection ni emballage » | A fifth packaging choice |
| F6 | « Il faut créer deux champs de données pour le pays concerné : pays de retrait, pays de livraison » | Countries |
| F7 | « rajouter au texte des champs adresse … de retrait, de livraison » | Labels |
| F8 | « Dans la liste des types de lieux, rajouter commissaire-priseur » / « Auction house ou auctioneer en anglais » | A location type |

---

## 0. Readings chosen without the client

| | Item | Reading built | Why |
|---|---|---|---|
| A | F6 which countries | **14**: France, Monaco, Belgium, Luxembourg, Netherlands, Germany, Switzerland, Austria, Italy, Spain, Portugal, Poland, Czechia, Romania (`JOB_COUNTRIES`, `src/lib/countries.ts`) | The countries Expedion quotes already deliver to that a van can reach from France without a customs border. The United Kingdom, Ireland, the United States and China are in the quotes too, and left out: one is a customs border, the others are a sea. One list to edit |
| B | F6 the country of an escalated job | Delivery: `expedion_quotes.delivery_country` read as a name in French or English (« Belgique », « USA », « fr »); unknown or blank → France. Pickup: France | Free text, 1,256 of 4,6xx blank; Expedion's pickups are French auction houses |
| C | F2 how big a move is | The client's own screen: the home's surface in m², or — « Je connais le volume exact » — the volume in m³ | Cocolis asks exactly this |
| D | F2 the weight a move is stored with | Volume (given, or surface ÷ 2) × 150 kg/m³, capped at 44 t, stored in `weight_kg` | The trade's rule of thumb. `weight_kg` is NOT NULL and is what vehicle matching reads; a move posted with no weight would match a moped |
| E | F2 the move's date | The When step, unchanged. « Doit être effectué avant le » is a flexible window ending on that day | The form already asks it, with weekdays and times of day |
| F | F2 / F4 a move's price | **No automatic estimate.** The Budget step says the movers will make their offers | There is no rate per m³; inventing one would be a quote nobody gave |
| G | F4 several items | The engine's single-parcel price × quantity, still ±15 %, still only where each item is ≤ 100 kg and ≤ 300 cm | A parcel carrier prices a consignment parcel by parcel. Before, ten boxes were priced as one |
| H | F3 which places have floors | House, apartment, office, shop, auction house, storage unit, other. Required for an apartment (as before), and for every one of them on a move | A warehouse, a port or a farm is loaded at ground level |
| I | F3 the lift | Asked as **Oui / Non** once the floor is 1 or higher, and required where the floor is | A switch could not say « non »: an apartment with no lift needed switching on and off again, and a ground floor was asked about a lift it does not need |
| J | F5 the fifth box | **Derived, not stored**: ticked exactly when the other four are off — the form's default, so it starts ticked. Ticking it clears the four; ticking any of the four clears it; it cannot be unticked on its own | "Nothing to do" was already representable as the four off. A stored flag could disagree with them |
| K | F1 dropdown or dialog | The **dropdown** the owner asked for on 7 October stays, renamed « Carnet d'adresses de retrait / de livraison », grouped by end, and always shown | Both asks at once |
| L | F8 escalated pickups | Every Expedion pickup is now `auction_house`; the delivery stays `other` | It was `other` only because the type did not exist |

---

## 1. Address book (F1)

### 1.1 What was wrong

| Symptom | Cause |
|---|---|
| No address book on « Où » | `SavedAddressPicker` rendered only when the requester had a saved address **with a map pin** (`WhereStep`, `pinnedAddresses`) |
| An address saved from `/create` never comes back | Typed by hand (no pin — the only way to give a foreign address), it is stored, then filtered out by the same rule |
| No « départ » / « arrivée » | One list for both ends; `used_for` was a badge |

### 1.2 Behaviour

- Each end shows « Carnet d'adresses de retrait » / « … de livraison », a
  `Select`, **always** — with no address saved it reads « Aucune adresse
  enregistrée » and says how to save one (the checkbox under the address).
- Options in three groups, each shown only when not empty: « Adresses de
  retrait » (`used_for` = this end), « Retrait ou livraison » (`null`),
  « Adresses de livraison » (the other end); then « Saisir une nouvelle
  adresse ». For the delivery the first and last groups swap.
- Addresses **without a pin are offered**. Applying one leaves the end with no
  coordinates, exactly as typing it would.
- Applying one sets the end's country from `addresses.country` (§6.5).
- `/profile/addresses` lists the addresses in the same three groups, each with
  « Ajouter » opening the form with « Utiliser pour » already set
  (`?for=pickup|dropoff`).
- Unchanged: one address is never put at both ends; auto-fill rules
  (saved_addresses_spec.md §3.2).

## 2. Moving request (F2)

### 2.1 Data — migration `0045_request_form_feedback`

| Column | Type | Meaning |
|---|---|---|
| `listings.job_kind` | enum `job_kind` (`items`, `moving`), NOT NULL DEFAULT `items` | What is being moved |
| `listings.moving_surface_m2` | integer, null | The home's surface, when that is what was given |
| `listings.moving_volume_m3` | double precision, null | The volume, when that is what was given |

Exactly one of the two sizes is set on a move, neither on items. Public in the
listing view (`listing-view.ts`).

### 2.2 The form

- Step « Quoi », items mode: a banner « Vous déménagez ? Cliquez plutôt ici ! »
  switches to moving mode. Moving mode has the reverse link.
  `/create?type=moving` opens in moving mode. A resumed draft opens in its own.
- Moving mode asks: photos; « Je connais le volume exact » (off: « Superficie
  du logement (m²) », 5–1 000, whole; on: « Volume (m³) », 0.5–200);
  « Informations complémentaires » (the description, public, with a line
  saying so); packaging (§5). Nothing else on the step.
- Sent: title « Déménagement · 65 m² » (or « · 30 m³ ») in the requester's
  language; weight per §0 D; no dimensions; quantity 1; `needsHelp` true
  (movers load); `isFragile` false.
- « Où »: floor required at every end of a type in §0 H (§3).
- Budget step: no estimate (§0 F).

### 2.3 Server

`createListingSchema` / `updateListingSchema`: `jobKind` (optional, `items`),
`movingSurfaceM2` (int, 5–1 000), `movingVolumeM3` (0.5–200).

| Code | When |
|---|---|
| `MOVING_SIZE_REQUIRED` | a move with neither or both sizes |
| `MOVING_SIZE_ON_ITEMS` | items with either size |
| `FLOOR_REQUIRED` | a move whose end is a §0 H type with no floor |

### 2.4 Display

« Déménagement » badge on the job page header, the board card and the
requester's summary; « Logement : 65 m² » or « Volume : 30 m³ » beside an
« estimé » weight on the job page and the driver's run.

## 3. Floors (F3)

- `FLOOR_LOCATION_TYPES` (`src/lib/location-types.ts`): §0 H. « Étage » shows
  for those; 0 is « Rez-de-chaussée ». Choosing another type clears floor and
  lift.
- « Type de lieu » moves to directly under the address, so its floor follows
  it.
- Lift: « Oui / Non », shown at floor ≥ 1, cleared at floor 0.
- Required: floor on an apartment, and on any §0 H end of a move; lift
  wherever the floor is required and is ≥ 1.
  Server: `APARTMENT_LIFT_REQUIRED` now applies only at floor ≥ 1 (relaxed).
- **Shown** — they were collected and shown nowhere: the job page's ends and
  the driver's run, « 3ᵉ étage · sans ascenseur », « Rez-de-chaussée ».

## 4. Price estimate (F4)

- The estimate is a card: « Estimation du prix : 120 € – 165 € », « Utiliser
  145 € ».
- Quantity multiplies it (§0 G).
- An end with no pin is geocoded **for the estimate only**, from its address,
  postal code and city in its country (Nominatim, as the map search does).
  Nothing is written to the form.
- No estimate: a line saying why — a move (« les déménageurs vous feront leurs
  offres ») or anything else (« pas d'estimation automatique »).
- Always, under it, « Comment ça marche » in four steps: offers arrive → you
  choose → you pay when you accept → the transporter is paid after delivery.

## 5. « Ni protection ni emballage » (F5)

- A fifth row in « Emballage », first, full width: ticked iff
  `packagingLevel` is unset and `needsProtection`, `needsPackaging` are false
  (`hasNoPackaging`, `src/lib/cargo-packaging.ts`). §0 J.
- No schema change. Escalated jobs never land in it (they always carry
  « Déjà protégé » or « À protéger »).
- Shown: a badge on the job page; the summary's « Protection » reads « Ni
  protection ni emballage » instead of « Non précisée ».

## 6. Countries (F6)

### 6.1 Data

`listings.pickup_country`, `listings.dropoff_country`: text, NOT NULL DEFAULT
`'FR'`, check `^[A-Z]{2}$`. Every existing row is French (checked on
production 2026-10-31: 13 listings, all 5-digit postal codes). Public in the
view.

### 6.2 The form

« Pays de retrait » / « Pays de livraison » above each end's address, France
by default, the 14 of §0 A by name (`Intl.DisplayNames`, the reader's
language). Changing it clears that end's address. The country then drives:

| What | How |
|---|---|
| Address search | Nominatim `countrycodes` = the country |
| A pin | refused when reverse geocoding says another country (« Ce point est hors du pays choisi ») |
| The map | centred on and bounded to the country |
| Postal code | the country's format (`postalCodePattern`), message with an example |
| Coordinates | within the country's box (`isInCountry`), replacing the France box |

### 6.3 Server

Endpoint `country`: one of `JOB_COUNTRIES`, optional (France). Postal code and
coordinates checked per country: `INVALID_POSTAL_CODE`,
`LOCATION_OUT_OF_COUNTRY` (same codes as before).

### 6.4 Display

The country's name after the city wherever it is not France: job page, board
card, summary, driver's run.

### 6.5 Saved addresses

`addresses.country` stays free text (the profile form writes a name). A saved
address is read as a country by `countryCodeFrom` (ISO code or a French,
English or native name); unknown → France. `/create` saves the country's name
in the requester's language.

## 7. Labels (F7)

The address box's label and search placeholder read « Adresse de retrait » /
« Adresse de livraison », « Rechercher l'adresse de retrait… ».
`LocationPickerField` gains `addressLabel` / `searchPlaceholder`; other callers
are unchanged.

## 8. « Commissaire-priseur » (F8)

- `auction_house` added to `location_type` (`ADD VALUE … AFTER 'shop'`), FR
  « Commissaire-priseur », EN « Auction house ».
- One list: `LOCATION_TYPES` in `src/lib/location-types.ts`; the pg enum, the
  DTO and the form derive from it (CLAUDE.md gotcha 8).
- Escalation stamps the pickup `auction_house` (§0 L).
- A place, not a goods auction: gotcha 1 is about selling goods.

---

## 9. Test coverage required

- `countries`: every country has a pattern and a box; patterns accept their
  example and refuse another country's; `countryCodeFrom` on codes, French,
  English, native names, accents, blank; `isInCountry` on a capital of each.
- `/create` schema: a Belgian end with 1000 passes, a French end with 1000
  fails; a pin in Brussels passes as BE and fails as FR; a move needs exactly
  one size; a move needs floors on a house; an apartment at floor 0 needs no
  lift; items need a title and a weight bracket, a move does not.
- listing DTO: the same cases, with the codes of §2.3 / §6.3.
- `toCreatePayload`: a move's title, weight (surface and volume), help,
  quantity; items unchanged; country passed.
- `fromListing`: a moving draft resumes in moving mode with its size; country
  read back.
- `listing-view`: the new columns classified.
- escalation: pickup `auction_house`; delivery country from « Belgique », « USA », blank.
- `hasNoPackaging`; `PackagingField`: the fifth row starts ticked, clears the
  four, is cleared by any of them.
- address book: unpinned addresses offered; groups ordered by end; applying
  one sets the country; `matchSavedAddress` on a pin-less address.
- price suggestion: quantity multiplies; no request for a move.
- floor text: RDC, 1er, nᵉ, with / without lift, in both languages.
- migrations journal test passes with `0045`.
