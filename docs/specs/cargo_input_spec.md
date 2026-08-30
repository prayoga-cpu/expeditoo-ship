# Cargo input — weight brackets, size presets, multiple photos

`/create` step 1 ("Quoi") · `src/features/app/create/`

Related: [`transport_listing_spec.md`](./transport_listing_spec.md) §2, whose
payload this changes nothing about.

---

## 1. The problem

Step 1 asked three numeric questions a requester usually cannot answer:

- **Poids (kg)** — an empty spinner. Someone moving a sofa does not know it
  weighs 78 kg, so they guess or stall. The screenshot that prompted this shows
  the field focused and empty with *"Doit être supérieur à 0"* underneath: the
  form was scolding a person for not knowing a number.
- **Longueur / Largeur / Hauteur (cm)** — three more, and all-or-nothing, so
  measuring two sides out of three is worse than measuring none.
- **Photos** — the dropzone already accepted several files, but nothing on
  screen said so, and its own cap (5) contradicted the comment claiming it
  matched the server's (10).

## 2. What changes, and what does not

**The stored shape does not change.** `listings.weight_kg` is still one
`double precision`, and `length_cm` / `width_cm` / `height_cm` are still three.
`createListingSchema` is untouched, no migration is written, and no other
surface — the board, `JobCard`, `JobDetail`, `TakeJobPanel`, the pricing engine
— learns a new vocabulary.

A bracket is an **input affordance that resolves to a number**, and it resolves
**upward, to its ceiling**. That direction is not a detail:
`TakeJobPanel` offers a job to a vehicle when `maxWeightKg >= job.weightKg`
(`src/features/app/offers/ui/TakeJobPanel.tsx:46`), so a bracket that resolved
downward would put a 90 kg load in a van rated for 50. The ceiling is the
conservative reading of "up to", and it is what the driver sees.

The one thing this costs: a driver reading a job now sees `30 kg` where the
requester meant "somewhere between 5 and 30". That is the same overstatement
"up to 30 kg" already carries, always in the safe direction. If the bracket
label itself ever has to reach the driver, that is a `weight_bracket` column
and a migration — deliberately not done here.

---

## 3. Weight

One required choice from six cards. `create.what.weightBrackets.<id>.label` and
`.example`; ceilings live in `src/features/app/create/cargo.ts`.

| id | label | example | resolves to |
|---|---|---|---|
| `upTo5` | Jusqu'à 5 kg | Un colis, une montre | 5 |
| `upTo30` | 5 – 30 kg | Une valise, un carton | 30 |
| `upTo100` | 30 – 100 kg | Un lave-linge, un fauteuil | 100 |
| `upTo500` | 100 – 500 kg | Une moto, plusieurs meubles | 500 |
| `upTo1000` | 500 kg – 1 t | Une palette complète | 1000 |
| `over1000` | Plus d'1 t | *asks for the figure* | the figure |

`over1000` is the exception that keeps the form honest. The DTO allows up to
`MAX_WEIGHT_KG` (44 000) and the marketing says 44 t, so removing every way to
express a freight load would narrow what the product accepts. Choosing it
reveals one number input, and that input is the only free weight entry left.

### 3.1 Validation (`create.validation.*`)

| Condition | Path | Key |
|---|---|---|
| No bracket chosen | `weightBracket` | `weightRequired` |
| `over1000`, no figure | `exactWeightKg` | `weightRequired` |
| `over1000`, figure ≤ 1000 | `exactWeightKg` | `weightAboveBracket` |
| Figure > 44 000 | `exactWeightKg` | `weightMax` |

A figure typed under `over1000` and then abandoned by picking another bracket is
ignored, not cleared: `resolveWeightKg` reads the ceiling first and only falls
through to `exactWeightKg` when there is none.

---

## 4. Size

Optional, as it always was, and now asked in two modes chosen by a segmented
control (`create.what.sizeModes.*`).

**`preset`** (default) — five cards. Each names a size and an object of that
size, and shows the dimensions it resolves to, so nothing is hidden from the
person choosing:

| id | example | resolves to (L × W × H cm) |
|---|---|---|
| `s` | Une montre, un petit colis | 40 × 30 × 25 |
| `m` | Une valise, un carton de déménagement | 80 × 60 × 50 |
| `l` | Un vélo, un lave-linge | 180 × 80 × 120 |
| `xl` | Un canapé, un réfrigérateur | 220 × 100 × 200 |
| `xxl` | Une palette complète, un lit double | 300 × 150 × 220 |

Choosing nothing is valid and submits no dimensions, exactly as leaving the
three fields blank did.

**`exact`** — the three centimetre inputs, unchanged, including the
all-or-nothing rule (`dimensionsPartial`). That rule now applies **only** in
this mode; in `preset` mode the three fields are not on screen and a stale value
left in one of them cannot fail a submit.

`resolveDimensions` reads the active mode only, so switching modes back and
forth never mixes a preset with a typed number.

---

## 5. Photos

The dropzone already accepted multiple files. What was missing was any sign of
it, and a cap that disagreed with the server's.

- `MAX_PHOTOS` 5 → **10**, matching `photos: z.array(...).max(10)` in
  `listings.dto.ts`. The comment claiming it already matched was wrong.
- The count is on screen (`create.dropzone.count`, "3 / 10") and the subtitle
  says several may be picked at once.
- **"Prendre une photo" opens the camera.** It shared the gallery picker's
  input, so on a phone it opened the gallery — a button labelled *take a photo*
  that could not take a photo. It now has its own input with
  `capture="environment"`.
- Selecting more than the remaining slots truncates as before, but says so
  (`create.dropzone.tooMany`) instead of silently discarding.
- At ten photos the dropzone stops accepting clicks and drops, and reads
  `create.dropzone.full`.

Partial-failure behaviour is unchanged: whatever uploaded is kept.

---

## 6. Test coverage required

`src/features/app/create/__tests__/`

**`cargo.test.ts`**
- every bracket id has a ceiling, every preset id has three dimensions
- `resolveWeightKg` returns the ceiling for each bracket, and the typed figure
  for `over1000`
- `resolveWeightKg` ignores a typed figure when a ceiling exists
- `resolveDimensions` returns preset dimensions in `preset` mode, the typed
  values in `exact` mode, and nothing when a preset is unchosen

**`schemas.test.ts`** (extends the existing file)
- a request with a bracket and no dimensions parses
- a missing bracket raises `weightRequired`
- `over1000` without a figure raises `weightRequired`; with 900 raises
  `weightAboveBracket`; with 12 000 parses
- `dimensionsPartial` fires in `exact` mode and **not** in `preset` mode

**`jobs.api.test.ts`**
- `toCreatePayload` sends the ceiling as `weightKg`
- it sends the preset's dimensions in `preset` mode and the typed ones in
  `exact` mode
- it omits dimensions entirely when no preset is chosen

**`WhatStep.test.tsx`**
- every bracket and preset label resolves in both catalogues (no raw key text)
- choosing `over1000` reveals the figure input; choosing another hides it
- switching to `exact` shows the three centimetre inputs and hides the cards
