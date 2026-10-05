# Plan — Typed Numbers Read the Way They Are Meant

**Spec:** `docs/specs/numeric_input_spec.md`
**Date:** 2026-10-05

The owner, on the Budget step: *"auto fix the type that 040 can't happen, so
it'll be regex to automatically typed the 40"*.

A `type="number"` box cannot be cleaned up as it is typed (spec §1), so every
number a requester or a carrier types becomes a text box run through one rule.
The same change fixes two places that saved the wrong amount, and makes the
form check the budget limits the server already enforces.

No migration, no API change, no new route.

---

## 1. The rule (`src/lib/numeric-input.ts`)

Pure, no React, so the schema can import it too.

1. `sanitizeNumericInput(raw, caret, rules, separator, previous)` — digits and
   one separator, shown the language's way; a lone leading zero dropped once a
   digit follows; anything else removed; an edit that breaks a limit refused
   whole, back to `previous`; the caret kept after the same kept characters.
2. `parseDecimal`, `parseScaled`, `parseCents` — on the digits, never
   `x * 100` on a float.
3. `centsToInput`, `numberToInput`, `decimalSeparatorFor` — text a box starts
   from.
4. `NUMERIC_RULES` — `MONEY`, `KG`, `TONNES`, `CM`, `COUNT`, and (after
   review) `QUANTITY`, five whole digits.

## 2. The box (`src/components/ui/numeric-input.tsx`)

Beside `phone-input.tsx`.

1. `NumericInput` — `type="text"`, `autoComplete="off"`, `inputMode` from the
   rules. Cleans the element in place, sets the caret, then calls the caller's
   `onChange`, so it works under `{...register()}` and in React state alike.
2. `useNumericText` — the text of a box whose number is held elsewhere,
   rebuilt from the number only when the number moves from outside. This is
   the fix for both wrong amounts.

## 3. `/create`

1. `schemas.ts` — one `typedNumber` preprocess for every typed field; budget
   gets `budgetMin` / `budgetMax`; quantity and floor get translated messages.
2. `useJobForm.tsx` — `budgetEuros: ""` loses its cast (the input type is now
   `unknown`, like the other preprocessed fields).
3. `JobForm.tsx` — Budget (`MONEY`, registered), floor (`COUNT`; the form
   holds a number, the box its own text through `useNumericText` after review).
4. `ItemField.tsx` — one-item quantity registered on `QUANTITY` (after review;
   it was `COUNT`, three digits); each row of several holds its text, may be
   emptied, and returns to 1 on blur.
5. `SizeField.tsx` — the three centimetre boxes on `CM`.
6. `WeightBracketField.tsx` — the figure keeps its text through
   `useNumericText`; tonnes are read on the digits.
7. `jobs.api.ts` — unchanged logic; the payload test proves « 40,5 » is 4050.

## 4. Carriers and staff

1. `SubmitOfferForm.tsx`, `ThreadOfferDialog.tsx` — prefill with
   `centsToInput`, read with `parseCents`.
2. `QuoteDetailDialog.tsx` — its six number boxes become one
   `QuoteNumberInput` on `useNumericText`: the accepted price and the declared
   value (the 405 € bug), and the weight and three dimensions, which turned out
   to share the round trip — « 12.05 » kg saved 125 kg, reproduced in Chromium.

## 5. Translations

`create.validation.budgetMin`, `budgetMax`, `quantityMin`, `floorMin`,
`wholeNumber`, FR and EN together. Delivered as `i18n.patch.json` for the
integrator, who owns `messages/*.json` this release.

## 6. Order of work

1. This plan and the spec.
2. `numeric-input.ts` + `src/lib/__tests__/numeric-input.test.ts`.
3. `numeric-input.tsx` + `src/components/ui/__tests__/numeric-input.test.tsx`.
4. `schemas.ts`, `useJobForm.tsx` + `schemas.test.ts`, `jobs.api.test.ts`.
5. The `/create` fields + `WhatStep.test.tsx`, `BudgetStep.test.tsx`.
6. The two price fields + `SubmitOfferForm.test.tsx`; `QuoteDetailDialog.tsx`.
7. `npx tsc --noEmit`, ESLint on every touched file, the suites above.
8. Chromium, because jsdom does not reproduce a browser's number-box
   behaviour and does not move a caret the way a keyboard does. Done on the
   real components bundled into a bare page (spec §11). Still to do on the
   running app before release: `/create` and a job page at phone width, FR and
   EN, light and dark — the boxes keep `Input`'s classes, so nothing should
   move, but nobody has looked.

## 7. Deliberately not done

- The staff and board fields in the analysis table (board filters, trip
  capacity, vehicle form, driver capacity, platform fee, reprice, storage):
  decision 3 kept them out, and none of them saves a wrong amount from « 040 ».
  Spec §10 lists what each still does.
- A `pattern` attribute: the form never submits natively.
