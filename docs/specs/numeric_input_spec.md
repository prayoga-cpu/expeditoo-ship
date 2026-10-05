# Spec — Typed Numbers: « 040 » Reads « 40 »

**Status:** implemented 2026-10-05 (2.60.0).
**Plan:** `docs/plans/plan_numeric_input.md`
**Amends:** `cargo_input_spec.md` §3–4 (the weight figure and the three
centimetre boxes are text boxes now), `publication_timing_spec.md` §3.6 (how a
blank budget reaches Zod — unchanged in effect, changed in mechanism).

---

## 1. What this is

The owner, on the Budget step of `/create`:

> auto fix the type that 040 can't happen, so it'll be regex to automatically
> typed the 40

Every number a requester or a carrier typed was an `<input type="number">`.
Chromium keeps « 040 » in one because it is a valid number, and nothing can
tidy it as it is typed. Checked in headless Chromium (Playwright 1.57, en-US
and fr-FR):

- **The page cannot see what the box shows.** `value` is `""` while it shows
  « 1. », « 1e » or « - ».
- **The caret cannot be kept.** `selectionStart` is `null` and
  `setSelectionRange` throws `InvalidStateError`, so any rewrite throws the
  caret to the end.
- **React compares a number box loosely** (`element.value != value` in
  `react-dom-client`'s `updateInput`). A box controlled by a number never
  rewrites « 040 » (`40 == "040"`); a box whose text is re-derived from a
  number rewrites on every keystroke, and turns « 1.0 » into « 1 », losing
  whatever was to follow.

That last rule was already saving wrong amounts:

| Where | Typed | Saved |
|---|---|---|
| `/create`, exact weight in tonnes (`WeightBracketField`) | 1.05 t | **15 t** |
| `/admin/expedion`, accepted price and declared value (`QuoteDetailDialog`) | 40.05 € | **405 €** |
| `/admin/expedion`, weight (found while fixing the line above) | 12.05 kg | **125 kg** |

And the form never checked the budget limits the server enforces (1 € to
100 000 €, `MIN_BUDGET_CENTS` / `MAX_BUDGET_CENTS` in `listings.dto.ts`): 0,50 €
or 150 000 € passed every step, then failed as « Impossible de publier votre
demande. Veuillez réessayer. » — and retrying could not fix it.

So every number a requester or a carrier types is now a **text box** that one
rule (§3) keeps a number, and every box whose number lives elsewhere keeps the
text that was typed (§5.2).

## 2. Decisions (approved by the owner)

| # | Question | Decision |
|---|---|---|
| 1 | Can a budget or a price carry cents? | Yes: up to 2 decimals, typed with « , » or « . ». Nothing typed is ever silently multiplied. |
| 2 | Which separator does the box show? | The language's own: « , » in French, « . » in English — whatever was typed. |
| 3 | Which fields? | Every number on `/create`, and the two carrier price fields. Staff screens and board filters keep `type="number"` (§10), except where a wrong amount was saved. |
| — | Wrong amounts | Fixed whatever the scope. |

## 3. The rule (`src/lib/numeric-input.ts`)

`sanitizeNumericInput(raw, caret, rules, separator, previous, inserted?)` →
`{ value, caret, refused? }`. `raw` and `caret` are the box after an edit;
`previous` is what it held before; `inserted` is `true` when the browser said
the edit put text in (§5.1), and `false` by default; `refused` is `true` on a
refusal and absent otherwise.

1. **Kept:** ASCII digits, and **one** decimal separator, typed « , » or « . »
   and shown as `separator`.
2. **Removed:** everything else — spaces (no-break ones too), « € », letters,
   « + », « - », « e ». « 1e3 » is never read as 1000.
3. **Leading zero:** a whole part that is a lone « 0 » loses it as soon as
   another digit follows. « 040 » → « 40 », « 00 » → « 0 », « 007 » → « 7 ».
   A lone « 0 » stays (floor 0, « 0,50 »). A leading separator gains one:
   « ,5 » → « 0,5 ». The number shown never changes by this rule — « 040 »
   *is* 40.

   **A deletion is not tidied** — an edit that only takes characters out
   (Backspace, Delete, a cut: `raw` is `previous` with characters removed and
   nothing added). It keeps the zeros it exposes: « 200 » with its « 2 » deleted reads « 00 », so the « 1 »
   typed in its place gives « 100 ». Tidied at once, it read « 0 » with the
   caret in front, and the « 1 » gave « 10 » — a price ten times too small,
   from the very boxes that open pre-filled with a round budget (found in
   review). The same holds for « 0,5 » t with its « 0 » deleted: « ,5 » stays,
   and a « 2 » typed in front gives « 2,5 », not « 20,5 ». Leaving the box
   tidies what a deletion kept (§5.1). Anything typed or pasted is tidied as
   it lands, a paste over a selection included: « 040 » pasted over « 89,90 »
   reads « 40 ».

   The text alone cannot always tell the two apart. « 0 » typed over the
   « 20 » of « 2040 », or « 040 » pasted over all of « 1040 », leaves the
   « 040 » that deleting the « 2 » leaves — so an edit the browser says put
   text in (`inserted`) is tidied whatever its text looks like. Read from the
   text, those kept their zero until the box was left, and in the tonnes box
   « 0 » typed over the « 10, » of « 10,05 » was refused, its kept zeros
   counted as whole digits (found in review).
4. **Refused, whole:** an edit whose result has more whole digits than
   `rules.integerDigits`, more decimals than `rules.decimals`, any separator
   when `rules.decimals` is 0, or two separators. The box gets `previous` back,
   flagged `refused`, with the caret where the edit began as far as the lengths
   tell: `caret − (raw.length − previous.length)`, clamped to `previous`. That
   is right for anything typed or pasted at the caret and for Backspace, and
   wrong for Delete, whose caret does not move, and for a selection, which it
   cannot rebuild — so the box puts back the exact selection the edit began
   from wherever it noted one (§5.1), and uses this caret only when it did not.
   A refusal is never a truncation: cutting digits off in the middle of an
   amount changes the amount.
5. **Caret:** after as many kept characters as stood before it in `raw` — the
   way `SiretField` (`CarrierProfileForm.tsx`) keeps its own. A swapped
   separator keeps the length, so it never moves the caret; the « 0 » given to
   a leading separator travels with it.

The table is written as the French box shows it. In English every « , » the
box shows is a « . », before the edit and after it, while what was typed stays
as typed — either separator is read in either language — and every row holds
in both. A row that types or pastes something is an edit the browser reports
as inserted text. The caret column is the rule's; on a refusal the box puts
back the selection it noted instead (§5.1).

| Rules | Before → typed | Box | Caret |
|---|---|---|---|
| any | « 40 », « 0 » at the start | « 40 » | 0 |
| `MONEY` | « 1500 », « 0 » after the « 1 » | « 10500 » | 2 |
| `MONEY` | « », « , » | « 0, » | 2 |
| `MONEY` | « 40 », « .5 » | « 40,5 » | end |
| `MONEY` | « 40 », « ,5 » | « 40,5 » | end |
| `MONEY` | « 123456 », « 7 » | « 123456 » (refused) | 6 |
| `MONEY` | « 12,34 », « 5 » | « 12,34 » (refused) | 5 |
| `MONEY` | « 12,5 », « , » anywhere | « 12,5 » (refused) | where it was |
| `MONEY` | « 123456,78 », the « , » deleted | « 123456,78 » (refused) | 7 (the box: 7 after Backspace, 6 after Delete) |
| `MONEY` | « 1200,50 » all selected, « 1.200,50 € » pasted | « 1200,50 » (refused) | 7 (the box: all of it selected again) |
| `COUNT` | « 12 », « , » | « 12 » (refused) | 2 |
| `QUANTITY` | « 120 », « 0 » | « 1200 » | 4 |
| `TONNES` | « 12 », « 3 » | « 12 » (refused) | 2 |
| `MONEY` | « », « 1 200,50 € » pasted | « 1200,50 » | end |
| `MONEY` | « », « 1.200,50 € » pasted | « » (refused) | 0 |
| `MONEY` | « », « -40 » pasted | « 40 » | end |
| `MONEY` | « 2040 », « 0 » typed over the « 20 » | « 40 » | 0 |
| `TONNES` | « 10,05 », « 0 » typed over the « 10, » | « 5 » | 0 |

A pasted « 1.200,50 € » is refused rather than read: which of two separators is
the decimal one cannot be told from the text without guessing, and a wrong
guess moves the decimal point. « 1 200,50 € » — French grouping with spaces,
no-break ones included — is read.

**Presets** (`NUMERIC_RULES`):

| Preset | Whole digits | Decimals | Why |
|---|---|---|---|
| `MONEY` | 6 | 2 | reaches 100 000 €, the most a budget or an offer may be |
| `KG` | 5 | 1 | reaches the 44 000 kg a lorry carries, to 100 g |
| `TONNES` | 2 | 3 | the same 44 t, to the kilogram |
| `CM` | 4 | 1 | a 13,6 m trailer is 1360 cm |
| `QUANTITY` | 5 | 0 | the 99 999 items a request may count — exactly `quantityMax` (§8) |
| `COUNT` | 3 | 0 | floors |

The limits keep a stray key from producing an absurd figure. What is *too much*
is still the schema's to say (§8): « 150000 » fits `MONEY` and is refused by
`budgetMax`.

A limit that a real figure can reach stops no stray key: it makes a wrong
amount, since the refused keystroke leaves a smaller number that is just as
valid. Quantities shared `COUNT` with floors until review found it: « 1200 »
chairs read « 120 » and were posted as 120, with no message — the schema took
any count from 1. `QUANTITY` has its own five digits, and `quantityMax` says in
words where they stop.

## 4. Reading and writing the text

All on the digits — never `x * 100` on a float.

| Function | Contract |
|---|---|
| `parseDecimal(text)` | the number shown: « 40,5 » and « 40.5 » → 40.5, « 40, » → 40, « ,5 » → 0.5; `null` for « », « , » or anything that is not digits around at most one separator |
| `parseScaled(text, decimals)` | the text as a whole number of its smallest unit: « 40,05 », 2 → 4005; « 1,05 », 3 → 1050; `null` when there is no number or more decimals than `decimals` |
| `parseCents(text)` | `parseScaled(text, 2)` |
| `centsToInput(cents, locale)` | money a box starts from: 8990 → « 89,90 » (fr) / « 89.90 » (en), 4000 → « 40 », 5 → « 0,05 »; « » for a negative or non-finite figure |
| `numberToInput(value, decimals, locale)` | a measure a box starts from, rounded to `decimals`, trailing zeros dropped: 45.5, 1 → « 45,5 »; 1.05, 3 → « 1,05 »; 12, 1 → « 12 » |
| `decimalSeparatorFor(locale)` | « , » or « . », as `Intl.NumberFormat` writes the locale; « . » for anything else |

## 5. The box (`src/components/ui/numeric-input.tsx`)

### 5.1 `NumericInput`

An `Input` with `type="text"`, `autoComplete="off"` and `inputMode="decimal"`
(`"numeric"` when the rules take no decimals). It takes `rules` and every
`<input>` prop but `type` and `defaultValue`.

On every change it runs §3 on the element itself, sets the caret, and **only
then** calls the caller's `onChange`. Whoever reads the event reads the clean
text, which is what lets one component serve both ways a form here holds a
field:

- **`{...register()}`** — react-hook-form reads `event.target.value`, now
  clean, and writes the same text back through its ref when the step
  remounts.
- **React state** (`value` + `onChange`) — the state then equals what the box
  already shows, so React finds nothing to rewrite and the caret stays put.

`previous` is `value` for a box in state. Under `register()` the element is the
only copy, so the box notes it on focus and after every edit.

**It tells the rule what the browser says the edit was.** An `inputType`
that begins `insert` — a key, a paste, a drop — sets `inserted` (§3.3), so a
digit typed over a selection is tidied even when its text reads like a
deletion. The one exception is `insertCompositionText`: an Android keyboard
may send it for a Backspace inside a composition, so it is left to the
rule's text test, like everything else — every `delete…`, an undo or a redo,
and the retype on blur (a plain `Event`, with no type).

**A refused edit gets back the selection it began from.** The rule's caret
comes from the lengths (§3.4), and review found where that goes wrong, with
real keystrokes in Chromium. Delete before the « , » of « 123456,78 » is
refused and put the caret after the « , » — in the tonnes box, where « 1,05 »
without its « , » is « 105 », that is nearly every Delete there, and the « 2 »
typed next gave « 1,205 » instead of « 12,05 ». A refused paste over the whole
text left nothing selected, so the next paste or keystroke was added to the
text instead of replacing it, refused in its turn, and the box looked frozen.

So the box notes the selection — start, end and direction — on keydown,
paste, cut and drop, which all come before the browser changes the text. The
change that follows takes the note, once, and a refusal puts that exact
selection back; the rule's caret serves only when nothing was noted. A key
that edits nothing (an arrow) is forgotten on its keyup, and anything noted
is forgotten when the box is left, so an edit that starts with no key, such
as dictation, falls back on the rule's caret rather than on a stale note.
Leaving is its own case because a Tab is noted on its keydown here and its
keyup lands on the next field. Review found it in Chromium: back in the box
by a click, a refused dictated digit put back the caret from before the Tab;
and a box tabbed through, which selects all of it, got all of it selected
again, so the next key replaced the whole amount. The caller's own
`onKeyDown`, `onKeyUp`, `onPaste`, `onCut` and `onDrop` still run.

**On blur** it forgets any noted selection, tidies what a deletion kept
(`tidyNumericText`: « 00 » → « 0 », « 040 » → « 40 », « ,5 » → « 0,5 »), and
writes the result the way typing does — past React's own record of the
value, then an `input` event — so the caller's `onChange` hears it, in state
and under `register()` alike, before the caller's `onBlur` runs. That order
is relied on: an item row's `onBlur` puts « 1 » back over a count left blank
or « 0 » (§6), and a tidy heard after it, worked out from the same rows,
would overwrite that « 1 » with « 0 » (review swapped the two to check).

No `pattern` and no native `maxLength`: the form never submits natively
(`JobForm`'s buttons are `type="button"`), and §3 is the limit.

### 5.2 `useNumericText(value, toText)`

The text of a box whose number is held somewhere else — kilograms in the
request form, cents in a quote patch. It returns `text`, `typed(text, parsed)`
and `reshow(format)`.

- The number is **never** turned back into text while it is typed. That round
  trip is the cause of all three wrong amounts in §1.
- The text is rebuilt from the number only when the number changes from
  outside — a bracket switched, a form refilled by « Analyser avec l'IA » — or
  when the caller asks with `reshow`, as for a change of unit.

## 6. The fields

| Field | Where | Preset | Held as |
|---|---|---|---|
| Budget | `JobForm.tsx` (Budget step) | `MONEY` | form text, `register` |
| Floor (apartment) | `JobForm.tsx` (Where step, `FloorInput`) | `COUNT` | the box's text (§5.2); form number |
| Quantity, one item | `ItemField.tsx` | `QUANTITY` | form text, `register` |
| Quantity, several items | `ItemField.tsx` | `QUANTITY` | each row's text; the form gets the sum |
| Length, width, height | `SizeField.tsx` | `CM` | form text, `register` |
| Exact weight | `WeightBracketField.tsx` | `KG` or `TONNES` | the box's text (§5.2); form number of kg |
| Offer price | `SubmitOfferForm.tsx` | `MONEY` | state text: `centsToInput(job.budgetCents)`, read with `parseCents` |
| Chat offer price | `ThreadOfferDialog.tsx` | `MONEY` | same |
| Accepted price, declared value | `QuoteDetailDialog.tsx` | 7 whole digits, 2 decimals | the box's text (§5.2); patch cents |
| Weight, length, width, height | `QuoteDetailDialog.tsx` | 6 whole digits, 3 decimals | the box's text (§5.2); patch number |

- **Several items.** A row's quantity may be emptied while it is retyped — it
  used to snap back to « 1 » on every keystroke, so replacing « 1 » with « 2 »
  gave « 12 ». While blank or « 0 » the row counts as one; on blur it reads
  « 1 » again. Found on the way past: the rows were updated inside `setRows`
  updaters that also called `setValue`, which React may run while rendering
  `ItemField` — adding an item and retyping a count raised « Cannot update a
  component while rendering a different component » (reproduced in Chromium
  on the code before this change). The rows are now worked out in the handler
  and `setValue` runs beside `setRows`.
- **Exact weight.** Tonnes are read with `parseScaled(text, 3)`, so « 1,05 » t
  is exactly 1050 kg. Switching the unit shows the same kilograms in the other
  scale (`numberToInput`, 1 decimal in kg, 3 in t) and does not change what is
  stored. Picking another bracket still clears the figure, and the box with it.
- **Floor** holds its text like the exact weight (§5.2), because a deletion
  can leave « 00 », which no number reads back as. It used to show its number
  as text, on the grounds that a whole count reads back as the same text —
  true until a deletion kept its zeros (§3.3). « 100 » with its « 1 » deleted
  was then rewritten from « 00 » to « 0 », with the caret thrown to the end,
  and the « 2 » typed in place of the « 1 » gave floor 2, not 200 (found in
  review). The form still holds a number (§7).
- **Quote figures.** `int4` holds the cents (`declared_value_cents`,
  `accepted_price_cents`), and seven whole euro digits is the most that always
  fits. A declared value is what an auction lot is worth, so it may pass the
  100 000 € of `MONEY`. Weights and dimensions arrive from the AI extraction
  with whatever precision it read; three decimals shows them as stored.

## 7. Form contract (for building `/create`'s values from a stored listing)

What `jobFormSchema` expects in each typed field, so whoever fills the form from
a stored listing — a draft reopened, a request copied — gets what the boxes
show and what the schema reads:

| Field | The form holds | From a listing |
|---|---|---|
| `budgetEuros` | text, as shown | `centsToInput(budgetCents, locale)`; « » when there is none — **never** `undefined` (CLAUDE.md gotcha 15) |
| `lengthCm`, `widthCm`, `heightCm` | text (a number is read too); « » means not given | `numberToInput(cm, 1, locale)`, « » for `null` |
| `exactWeightKg` | a number of kg, or `undefined` | `weightKg` itself |
| `quantity` | a number, or its text | `quantity` |
| `pickup.floor`, `dropoff.floor` | a number, or `undefined` | `floor ?? undefined` |

How the schema reads them, all through one preprocess (`typedNumber`):

- **text** → `parseDecimal`; text that is not a number reads as **0** — an
  ordinary issue on its own field (`budgetRequired`, `quantityMin`,
  `aboveZero`), never a type error;
- **blank** → `undefined` where the field is optional (dimensions, weight,
  floor) and **0** where it is not (budget, quantity);
- **a number** passes through; `undefined` stays `undefined`.

A type error — `undefined` for the budget, `NaN` from `z.coerce.number()` on
« 45,5 » — aborts the object before its `superRefine`, and the When step's date
rules silently stop running (`publication_timing_spec.md` §3.6). That is why the
budget stays seeded `""` and why no typed field is coerced any more. The input
type of every preprocessed field is `unknown`, so `budgetEuros: ""` needs no
cast.

`toCreatePayload` is unchanged: `budgetCents = Math.round(budgetEuros * 100)` on
the parsed number, so « 40,05 » € posts 4005.

## 8. Validation (`create/schemas.ts`)

| Field | Condition | Key |
|---|---|---|
| `budgetEuros` | blank or 0 | `budgetRequired` (unchanged) |
| `budgetEuros` | above 0, under 1 € | `budgetMin` |
| `budgetEuros` | over 100 000 € | `budgetMax` |
| `quantity` | blank or 0 | `quantityMin` |
| `quantity` | over 99 999, all rows together | `quantityMax` |
| `quantity`, floor | not a whole number | `wholeNumber` |
| floor | below 0 | `floorMin` |
| length, width, height | 0 | `aboveZero` (unchanged) |

| Key | FR | EN |
|---|---|---|
| `budgetMin` | Indiquez un montant d'au moins 1 € | Enter an amount of at least €1 |
| `budgetMax` | Le montant ne peut pas dépasser 100 000 € | The amount cannot exceed €100,000 |
| `quantityMin` | Indiquez au moins 1 | Enter at least 1 |
| `quantityMax` | La quantité totale ne peut pas dépasser 99 999 | The total quantity cannot exceed 99,999 |
| `floorMin` | Indiquez 0 (rez-de-chaussée) ou un étage supérieur | Enter 0 (ground floor) or a higher floor |
| `wholeNumber` | Indiquez un nombre entier | Enter a whole number |

`quantityMin` and `floorMin` replace Zod's English defaults: an emptied
quantity read « Number must be greater than or equal to 1 » in both languages.
`wholeNumber` and `floorMin` cannot be reached by typing — the boxes take no
decimals and no « - » — and exist so that nothing else reaching the schema is
answered in English. The budget bounds copy `listings.dto.ts` in euros, as
every rule in that schema copies one there.

`quantityMax` is where `QUANTITY` stops (§3): the sixth digit is refused
without a word, so the schema says it in words — and item rows, each within
the box, add up past it, which is why the message speaks of the total.
`listings.dto.ts` holds the same ceiling (`MAX_QUANTITY`), so a caller of the
API is refused it too.

## 9. The wrong amounts, fixed

All three re-derived the box from the number after every keystroke (§1), and
so did the floor, which review found once a deletion kept its zeros (§6).
Each now holds its text through `useNumericText` (§5.2):

- `WeightBracketField`'s figure: « 1.05 » t is 1050 kg.
- `QuoteDetailDialog`'s money: « 40.05 » is 4005 cents.
- `QuoteDetailDialog`'s weight and dimensions: « 12.05 » kg is 12.05.
- `JobForm`'s floor: « 100 », its « 1 » deleted and « 2 » typed in its
  place, is floor 200.

## 10. Not done

- **Still `type="number"`** (decision 3), none of them saving a wrong amount
  from « 040 »: the board filters (`JobBoard`), trip capacity
  (`TripRouteFormDialog`), the vehicle form (`VehicleForm`, which still reads
  « 0x10 » as 16), driver capacity (`CreateDriverDialog`), the platform fee
  (`PlatformSettingsPanel`, where an emptied box saves 0 %), and the reprice
  and storage fees (`RepriceDialog`, `StorageDialog`, where « 1e3 » is
  1 000 €). The last three are staff money fields with their own `toCents`;
  they are the next candidates for `NumericInput`.
- **An offer above 100 000 €** fits `MONEY` and is still refused by the server
  (`PRICE_OUT_OF_RANGE`), as before; the button is not gated on it.
- **Digits other than ASCII** (full-width, from an IME) are removed, not read.

## 11. Test coverage required

**`src/lib/__tests__/numeric-input.test.ts`**
- every row of the §3 table, value, caret and `refused`, in French and
  English: each row an edit to the box, the box's « , » shown « . » in
  English, what was typed left as typed and reported as inserted
- the leading-zero cases: « 040 », « 00 », « 007 », a lone « 0 », « 0,50 »,
  « ,5 »
- a deletion keeps the zeros it exposes: « 200 » → « 00 » → « 1 » typed in
  front gives « 100 »; « 0,5 » t → « ,5 » → « 2 » gives « 2,5 »; zeros typed in
  front of what a deletion left are still tidied; `tidyNumericText`
- an edit reported as inserted is tidied when its text reads like a
  deletion: « 0 » typed over the « 20 » of « 2040 » gives « 40 », where the
  text alone gives « 040 »; « 040 » pasted over all of « 1040 » gives « 40 »;
  in tonnes, « 0 » typed over the « 10, » of « 10,05 » gives « 5 », where the
  text alone refuses it
- a refusal at each limit of each preset, `QUANTITY` included, and two
  separators — every refusal flagged `refused`, no accepted edit flagged
- `QUANTITY` takes « 1200 » and « 99999 »; `COUNT` still stops a floor at
  « 120 »
- pastes: « 1 200,50 € » read, « 1.200,50 € » refused, « -40 », « 1e3 »
- `parseDecimal`, `parseScaled`, `parseCents` on « 40,05 », « 40, », « ,5 »,
  « », « , », too many decimals; `centsToInput` / `parseCents` round trips;
  `numberToInput`; `decimalSeparatorFor`

**`src/components/ui/__tests__/numeric-input.test.tsx`**
- under `register()`: « 040 » leaves « 40 » in the box and in the form; on
  blur, « 00 » left by a deletion reads « 0 » in the box and in the form;
  « 0 » typed over the « 20 » of « 2040 » (`insertText`) leaves « 40 » in both
- in state: the caller's `onChange` receives the clean text; a refused edit
  hands back the previous text; « 200 » with its « 2 » replaced by « 1 » is
  « 100 »; on blur the caller hears the tidied text, then its own `onBlur` —
  both logged in one list, so the order is what is asserted
- the browser's `inputType`: `insertText` and `insertFromPaste` over a
  selection are tidied (« 2040 » → « 40 », « 1040 » → « 40 »);
  `deleteContentBackward` and `deleteByCut` keep their zeros (« 00 »,
  « 005 »); `insertCompositionText` is left to the text (« 040 »)
- French shows « , », English « . »
- a refused edit puts back the selection noted as it began: Delete before the
  « , » of « 123456,78 » leaves the caret at 6, Backspace after it at 7; under
  `register()`, « 1.200,50 € » pasted over all of « 1200,50 » leaves all of it
  selected, direction included
- with nothing noted — an arrow noted on keydown and forgotten on keyup — the
  rule's caret; a note serves one edit only; the caller's own `onKeyDown` and
  `onPaste` still run
- a note does not outlive the focus: a Tab noted on keydown, its keyup on the
  next field, then a click back — a keyless refused edit gets the rule's
  caret, not the caret (6) or the whole selection (0–6) from before the Tab
- `useNumericText`: « 40,0 » then « 40,05 » survive their own round trip
  (the 405 € bug); a number changed from outside rebuilds the text; `reshow`

**`src/features/app/create/__tests__/schemas.test.ts`** (extends)
- « 40,5 » → 40.5; « 0,50 » → `budgetMin`; « 100001 » → `budgetMax`
- « » still raises `budgetRequired` **and** the When step's
  `deliveryBeforePickup` (the existing « runs the date rules while the budget
  is still blank » stays green)
- « 45,5 » cm is read as 45.5, and with dimensions as text a bad date is still
  reported
- blank or 0 quantity → `quantityMin`; floor −1 → `floorMin`; floor 1.5 →
  `wholeNumber`
- « 1200 », « 99999 » and 99 999 pass; « 100000 », and rows summed to
  120 000, → `quantityMax`

**`src/features/app/create/__tests__/jobs.api.test.ts`** (extends)
- « 40,5 » through the schema posts `budgetCents` 4050, and « 40,05 » 4005

**`src/features/app/create/__tests__/BudgetStep.test.tsx`** (the real
`JobForm` over the real `useJobForm`)
- typing « 040 » into the Budget box leaves « 40 », held as text in the form
- « 40.5 » shows « 40,5 »; the box starts blank; « 0,50 » raises `budgetMin`
  on the field

**`src/features/app/create/__tests__/WhatStep.test.tsx`** (extends)
- tonnes: typing « 1.05 » key by key stores 1050 kg and keeps « 1,05 » on
  screen
- a figure typed for one bracket is cleared, box and form, by picking another
- several items: a row's quantity empties, takes « 2 » rather than « 12 »,
  counts as one while blank, and returns to « 1 » on blur
- a row's « 100 » with its « 1 » deleted reads « 00 », and « 1 » once left:
  the box's tidy reaches the row before the row's own blur (§5.1)
- the one-item quantity drops « - » and refuses a separator
- « 1200 » typed in the one-item quantity holds « 1200 », box and form; the
  first row carries it over, and retyped — Backspace, then « 5 » — holds
  « 1205 », summed 1205
- a dimension typed « 045.5 » shows and holds « 45,5 »

**`src/features/app/create/__tests__/WhereStep.test.tsx`** (the real
`JobForm` over the real `useJobForm`)
- an apartment floor typed « 100 », its « 1 » deleted, reads « 00 » with the
  caret in front and floor 0; the « 2 » typed there gives « 200 », floor 200
- left with its « 1 » deleted, it reads « 0 », floor 0
- a floor already in the form when the box mounts is shown — a resumed
  draft's floors, the ground floor included, and a typed floor after
  « Suivant » then « Retour »; a floor changed while the box is shown is shown

**`src/features/app/offers/ui/__tests__/SubmitOfferForm.test.tsx`**
- prefilled from 8990 cents it shows « 89,90 » in French, « 89.90 » in English
- « 040 » shows « 40 » and submits `priceCents` 4000; « 40,05 » submits 4005
- an emptied price cannot be sent

**`src/features/app/messages/ui/__tests__/ThreadOfferDialog.test.tsx`**
- opening on a job shows « 89,90 » (fr) / « 89.90 » (en); with no job the box
  is blank, and « 040 » reads « 40 »

**In Chromium** (jsdom moves no caret the way a keyboard does): real
keystrokes into the real fields — the §3 table's carets, the paste, the
second comma, tonnes, several items, a dimension, both price boxes in both
languages, and `QuoteDetailDialog` saving 4005 cents for « 40.05 » and
12.05 kg for « 12.05 » — with no console warning. And the restored selection,
in French and English: Delete before the separator of the budget, tonnes, kg
and cm boxes leaves the caret before it, and the « 2 » typed next in tonnes
gives « 12,05 »; a digit refused over a Shift+Arrow selection keeps it,
direction included; « 1.200,50 € » pasted over a select-all is refused with
all of it still selected, and the next key replaces it; a quantity takes five
digits and a floor three. The same keystrokes against the box before the fix
reproduce each failure. Review's second round ran the box from before it
beside the fixed one. After a Tab out and a click back, a keyless refused
digit gets the rule's caret, where the old box put back the caret, or the
whole selection, from before the Tab. « 0 » typed over the « 20 » of
« 2040 » and « 040 » pasted over all of « 1040 » read « 40 », and « 0 »
typed over the « 10, » of « 10,05 » t reads « 5 »: the old box kept « 040 »
and refused the tonnes. Backspace and Delete still keep « 00 », and the next
digit gives « 100 » or « 200 ». On the real `JobForm`, a floor of « 100 »
with its « 1 » deleted reads « 00 » with the caret in front, « 2 » gives
200, and leaving tidies « 00 » to « 0 ».
