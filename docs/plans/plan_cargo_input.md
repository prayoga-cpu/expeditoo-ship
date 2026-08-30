# Plan — Weight brackets, size presets and visibly multiple photos

Spec: [`docs/specs/cargo_input_spec.md`](../specs/cargo_input_spec.md)

Three notes from the client, all on step 1 of `/create`. They are independent,
so they are built independently and share only the file they land in.

---

## 1. Where the numbers come from

New module `src/features/app/create/cargo.ts`: the bracket ids, the preset ids,
the ceilings each resolves to, and the two functions that do the resolving. It
holds no JSX and no Zod, so the schema, the form and the API mapper can all
import it without a cycle.

The ids are the source of truth; ceilings and dimensions are keyed off them with
`as const satisfies Record<Id, …>`, the same shape `MATERIAL_FIELDS` uses in
`listings.dto.ts`. Adding a bracket without a ceiling is then a type error
rather than an `undefined` weight reaching the API.

## 2. Schema (`schemas.ts`)

`weightKg` leaves the form schema. In its place:

- `weightBracket` — required enum, message `create.validation.weightRequired`
- `exactWeightKg` — optional, only meaningful under `over1000`
- `sizeMode` — `"preset" | "exact"`, defaulting to `preset`
- `sizePreset` — optional enum

`superRefine` gains the two `over1000` rules, and the existing
`dimensionsPartial` check is scoped to `sizeMode === "exact"`.

`STEP_FIELDS[0]` becomes
`["title", "description", "weightBracket", "exactWeightKg", "quantity", "lengthCm"]`
so Next gates on the new fields.

## 3. Payload (`api/jobs.api.ts`)

`toCreatePayload` calls `resolveWeightKg` and spreads `resolveDimensions`. The
REST contract is byte-for-byte what it was; only where the numbers come from
changes. This is the seam that keeps `createListingSchema` untouched.

## 4. UI

`WhatStep` was already ~85 lines and would have doubled, so the two new controls
become their own files:

- `ui/WeightBracketField.tsx` — six cards, plus the conditional figure input
- `ui/SizeField.tsx` — the mode switch, five cards, and the three inputs

Both are a Radix `RadioGroup` with a visually hidden item inside a `Label`, so
the cards keep radio semantics and arrow-key navigation; the focus ring moves to
the card via `focus-within`. `JobFormApi` moves from `JobForm.tsx` to
`useJobForm.tsx` and is imported by all three, rather than each file spelling
out a `UseFormReturn` generic that a resolver makes wrong.

## 5. Photos (`ui/PhotoDropzone.tsx`)

Cap 5 → 10, a visible count, a camera input of its own for "Prendre une photo",
and a message when a selection is truncated or the limit is reached. No change
to the upload path or to partial-failure handling.

## 6. Translations

New keys under `create.what` (`weightBrackets.*`, `weightExact`, `size`,
`sizeModes.*`, `sizePresets.*`, `sizeUpTo`, hints), `create.dropzone`
(`count`, `full`, `tooMany`) and `create.validation` (`weightRequired`,
`weightAboveBracket`). FR and EN keys added together — parity is exact and
checked by key diff, not by eye.

`create.what.weight` loses its "(kg)" suffix: the unit is now on every card.

## 7. Order of work

1. `cargo.ts` + `cargo.test.ts`
2. `schemas.ts` + the new cases in `schemas.test.ts`
3. `jobs.api.ts` + `jobs.api.test.ts`
4. Translations, both catalogues
5. `WeightBracketField`, `SizeField`, `WhatStep` rewrite, `PhotoDropzone`
6. `WhatStep.test.tsx`
7. `npx tsc --noEmit`, `pnpm lint`, `pnpm test`

## 8. Deliberately not done

- **No `weight_bracket` / `size_preset` column.** The ask is about the input,
  and a column means a migration that nothing in CI runs
  (`CLAUDE.md` §"Where Things Stand") for a label no driver asked for.
- **No edit path.** Drafts are write-only today — `saveDraft` posts and
  navigates to `/listings/me`, which redirects to `/expedion` — so nothing has
  to map a stored `weightKg` back to the bracket that produced it.
