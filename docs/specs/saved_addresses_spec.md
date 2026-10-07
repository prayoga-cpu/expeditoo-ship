# Spec — Saved addresses: one per side, a dropdown, and their real names

Owner's request, 2026-10-07, with three screenshots of `/create` « Où » and
`/profile`:

> - the saved default address auto-pick the same address on the pickup and
>   delivery (make the logic auto save as? pickup/delivery option, also never
>   auto choose it as the same address)
> - throw error/pop up that the address is the same, so that's why the next
>   button doesn't work
> - auto open the new address option if the saved address auto add on one field
> - on the profile, show multiple saved addresses, also when I click can't show
>   the list, give toggle to add, then option to add new one
> - fix the string name address to use from the address/the label (home work,
>   etc.)
> - on the pickup/delivery input, the saved addresses option has to be dropdown
>   toggle to choose

## 1. What was wrong

| Symptom | Cause |
|---|---|
| Both ends open on the same saved address | Each `EndpointFields` ran its own "pre-fill the default" effect, so both picked `default ?? first`, unaware of the other |
| « Suivant » does nothing, says nothing | `tooClose` is raised on `dropoff.address`, whose `<FieldError>` was rendered only while a *new* address was being typed. With a saved address chosen, the error existed but was never displayed |
| `profile.address.labelPresets.home` shown as a name | `AddressForm` saved `t("labelPresets.home")` under the `profile.address` namespace, but the presets live at `profile.address.form.labelPresets`. next-intl returns a missing key's path, and the path was stored as the label |
| `/profile` says "No address set" with two addresses saved | The card read `/api/user/addresses/default` only, and showed nothing unless one was the default |
| Clicking the card's button never shows the list | With no default, the button linked to `/profile/addresses/create`, not to the list |

## 2. Data — `addresses.used_for` (migration `0037_address_used_for`)

A nullable text column, `'pickup' | 'dropoff'`, with a check constraint.
It records which end of a transport the address usually is, so the request
form can fill each end with its own address.

- `null` means "either": the address can still fill the pickup (§3.2).
- Set automatically when an address is saved from `/create`: the end it was
  saved from.
- Set by hand in the profile form: « Utiliser pour » — *Retrait ou
  livraison* (null), *Retrait*, *Livraison*.
- The allowed values are `ADDRESS_SIDES` in `src/lib/saved-address.ts`. The
  Drizzle column and the DTO both derive from it.

The same migration rewrites every label stored as a raw translation key
(`profile.address.labelPresets.<id>` or `profile.address.form.labelPresets.<id>`)
to the bare preset id. The display helper (§5) also reads those keys, so a row
the migration has not reached still shows a name.

### DTO (`src/server/dto/addresses.dto.ts`)

`usedFor: z.enum(ADDRESS_SIDES).nullable().optional()` on create, and so on
update (`partial()`). Any other value is a `ZodError`, which the route already
answers 400 `VALIDATION_ERROR`. `addressesService.create` writes
`usedFor ?? null`. An update writes the column only when the field is sent;
`null` clears it.

## 3. `/create` « Où »

### 3.1 The saved addresses are a dropdown

`SavedAddressPicker` is a `Select` (combobox) above each end's fields, shown
when the requester has at least one saved address with a pin. Its options:

1. Every pinned saved address, in the server's order (default first, then
   newest). Each option shows the address's name (§5), a « Par défaut » badge,
   its side badge (« Retrait » / « Livraison ») and `street, zip city`. An
   address already chosen at the other end is labelled « Déjà le retrait » or
   « Déjà la livraison ». It stays selectable; choosing it raises §3.3.
2. « Saisir une nouvelle adresse », always last, always present.

The closed trigger shows the chosen address's name and street line, or
« Saisir une nouvelle adresse ». Choosing « Saisir une nouvelle adresse »
clears the end and shows the map/manual picker, as before.

### 3.2 Pre-filling — `autoPickAddresses` (`create/address-book.ts`)

This runs **once per form**, when the address list first arrives. It never
runs for a resumed draft, and it never overwrites an end that already has an
address. It is a pure function: given the pinned addresses and what each end
currently holds, it returns the address to put at each empty end, or `null`.

```
taken  = ids of saved addresses already matching a filled end
pickup = (pickup empty)  ? first of:
           an address with used_for = 'pickup'
           the default address, if used_for is null
           the first address with used_for null
         : null
taken += pickup
dropoff = (dropoff empty) ? first address with used_for = 'dropoff' : null
```

In every case, `taken` addresses are excluded.

Consequences, each covered by a test:

- **The two ends are never pre-filled with the same address.**
- An address with no side fills the pickup only. The delivery end is
  pre-filled only from an address the requester marked or saved as a delivery.
- When one end is pre-filled and the other is not, the other opens on
  « Saisir une nouvelle adresse », with the picker showing (owner: "auto open
  the new address option").
- An address marked `dropoff` never fills the pickup, even when it is the
  default.

The "done" flag lives in `useJobForm`, because « Où » unmounts on every step
change. Without it, going back from « Quand » would pre-fill an end the
requester had deliberately cleared.

### 3.3 Same address at both ends

`jobFormSchema` gains a rule ahead of `tooClose`. When both ends have an
address, and the normalised `address`, `postalCode` and `city` are equal
(lower case, accents and punctuation stripped, whitespace collapsed), it
raises `create.validation.sameAddress` on `dropoff.address`. Otherwise the
existing 500 m pin rule raises `tooClose` as before. Only one of the two is
raised.

It is shown in three places:

1. **Live**, under the delivery end, the moment the two ends are the same,
   whether by dropdown or by typing: « Le retrait et la livraison sont à la même
   adresse ». It does not wait for « Suivant ».
2. **Under the delivery end after « Suivant »**, whether that end is a saved
   address or a typed one. The saved-address branch now renders
   `dropoff.address`'s error, which it never did.
3. **As a toast** on a failed « Suivant » whose delivery error is `sameAddress`
   or `tooClose`: `create.toast.sameAddress` / `create.toast.tooClose`. This
   is the pop-up that says why the button did not move.

Like `tooClose`, the rule blocks a draft too. A request from A to A is a
contradiction in what was typed, not a question of time (gotcha 15).

### 3.4 Saving from `/create`

« Enregistrer cette adresse dans mon profil » now offers the same names as
the profile (§5): *Domicile*, *Travail*, *Stockage*, *Voisin*, *Autre* (free
text). The address is saved with `usedFor` set to the end it was typed at.
Left unnamed, it is saved under its city, not under « Retrait » /
« Livraison »: the side is now its own column, and the name should come from
the address.

## 4. `/profile` and `/profile/addresses`

### 4.1 The profile card

« Adresses » lists **every** saved address from `GET /api/user/addresses`,
using the `["user-addresses"]` cache that `/create` and `/profile/addresses`
already share. The default-only read is dropped from `useProfile`.

- Each row shows the name, « Par défaut » and side badges, and the street line.
  It links to that address's edit page with `returnUrl=/profile`.
- Three rows are shown. Beyond three, « Tout afficher (n) » / « Réduire »
  toggles the rest.
- « + Ajouter une adresse » is the last row, and the header's `+` button does
  the same. Both go to the create page with `returnUrl=/profile`.
- « Gérer mes adresses » links to `/profile/addresses`, whatever the default.
- Loading shows an inline loader. A failed read shows a message and
  « Réessayer » (gotcha 9). No addresses shows the empty text and the add row.

### 4.2 `/profile/addresses`

Same names and badges. Its copy, previously hard-coded English, is
translated. A failed read gets an error branch.

### 4.3 The profile form

The preset select writes the preset **id**. When editing, a stored id, a
legacy key or the preset's name in the current language all select that
preset. « Autre » with nothing typed saves under the city. The new
« Utiliser pour » select sets `usedFor` (§2).

## 5. Names — `src/lib/saved-address.ts`

- `ADDRESS_LABEL_PRESETS = ["home", "work", "storage", "neighbour"]`. « Autre »
  is the free-text choice, not a stored value.
- `addressLabelPreset(label)` returns the preset id for a stored id or a
  legacy key, and `null` otherwise.
- `addressDisplayName(address, presetName)`: a preset is shown in the
  reader's language, a free-text label as typed, and an empty label as the
  city. A raw `profile.address…` key never reaches the screen.

## 6. Not done

- No reordering of saved addresses, and no limit on how many.
- The side is a preference that fills the form, not a constraint. Any address
  can still be chosen at either end.

## 7. Test coverage required

- `saved-address.test.ts`: presets from ids and both legacy key shapes; names
  for a preset, a free-text label and an empty label; a raw key never shown.
- `address-book.test.ts` (`autoPickAddresses`): never the same address at both
  ends; untagged → pickup only; `dropoff`-tagged → delivery; a
  `dropoff`-tagged default is never the pickup; a filled end is left alone and
  its address excluded from the other; nothing pinned → nothing.
- `schemas.test.ts`: `sameAddress` for identical typed ends, with and without
  pins, accents and case ignored; `tooClose` still raised for two different
  addresses 40 m apart; no `sameAddress` when the cities differ.
- `WhereStep.test.tsx`: two saved addresses with no side fill the pickup only
  and open the delivery on « Saisir une nouvelle adresse »; the delivery shows
  the same-address error live; the dropdown shows names, not keys.
- `useJobForm.test.tsx`: a failed « Suivant » on the same address toasts
  `create.toast.sameAddress`; a ticked address is saved with `usedFor` = its end
  and its preset id; once pre-filling has run, an end cleared by hand stays
  clear across « Retour ».
- `addresses.service.test.ts` / DTO: `usedFor` written on create, `null` by
  default, rejected outside `pickup|dropoff`.
- `Profile.test.tsx`: every saved address listed, the toggle beyond three, the
  add and manage links.
- `migrations-journal.test.ts` passes with `0037`.
