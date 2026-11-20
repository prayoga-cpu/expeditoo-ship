# Request assistant — describe a request, the form fills itself

Release 2.86.0. Plan: `docs/plans/plan_request_assistant.md`.
Revised in 2.91.0 (client feedback 2026-11-19): the days the person states are
read (§4.6), and a reading that fails or never answers no longer costs them
their sentence (§4.3, §4.7).

The owner's ask, 2026-11-16: *« Could we use an AI tool about talk to it for
adding a new ad (when customer is connected) with the name and size of the item
and also picking and delivery cities? »*

## 1. What it is

A box at the top of `/create`, step « Quoi ». A signed-in requester types or
dictates a sentence — « un canapé 3 places de Lyon à Bordeaux » — and gets back
a reading: the item, its size, its weight, the pickup town, the delivery town
and, when they were said, the pickup and delivery days. « Remplir le
formulaire » writes that reading onto the form.

## 2. What it is not

- **It never creates, saves or publishes a request.** The assistant's only
  output is values for the form. The requester still walks the four steps and
  presses « Publier »; every rule in `jobFormSchema` and `createListing` still
  decides what reaches the board.
- It does not set a budget, a street, a pin, a contact, photos, an hour or
  `origin`. None of those are in its answer's shape.
- `requestAssistantService` has no path to `listingsService` and must not grow
  one: it answers values, and the form is the only thing that posts.
- **Until 2.91.0 it did not set dates either, by rule. That rule is reversed,
  deliberately.** The client typed « enlèvement le 20, livraison le 22 », the
  reading dropped both, and the When step kept its defaults — tomorrow and the
  day after — which nobody had said and which were then one « Suivant » from
  being published. A date left out silently is worse than a date read and
  shown. What has not changed is who decides: the days are shown in the
  reading, written onto a step the requester still walks, and checked by the
  same publication rules as days typed by hand (§4.6).
- It is not offered on a move (`?type=moving`) or on a request being resumed —
  and `applyAssistant` never writes a day onto a resumed request even if it
  were called there.
- It stores nothing: no conversation, no text, no recording.

## 3. API

All three routes need a session (`401` otherwise). The service is
`requestAssistantService` (`src/server/services/request-assistant.service.ts`);
the contract is `src/server/dto/request-assistant.dto.ts`.

### 3.1 `GET /api/listings/assist`

`{ available: boolean }` — whether `OPENAI_API_KEY` is configured. The form
renders the box only when this is `true`; a failed check hides it too.

### 3.2 `POST /api/listings/assist`

Body `{ text }`, 3–1500 characters after trimming. Rate limit: 10 per minute
per user. Answers a `RequestDraft`:

| Field | Meaning |
|---|---|
| `title` | The item, ≤ 120 characters, or `null` |
| `quantity` | Whole number ≥ 1, or `null` |
| `weightBracket` | A `WEIGHT_BRACKET_IDS` value, or `null` |
| `exactWeightKg` | Only a weight the person **stated**; else `null` |
| `sizePreset` | A `SIZE_PRESET_IDS` value, or `null` |
| `dimensions` | Only three measurements the person **stated**; else `null` |
| `pickup` / `dropoff` | `{ city, postalCode, country }`, or `null` |
| `pickupDate` / `deliveryDate` | A day the person **stated**, `YYYY-MM-DD`, already checked (§4.6); else `null` |
| `missing` | Subset of `title, size, weight, pickup, dropoff, when`, in that order |
| `outOfArea` | Ends named in a country outside `JOB_COUNTRIES` |

Stateless. A follow-up answer is sent as the earlier text plus the new line,
and the whole is read again.

### 3.3 `POST /api/listings/assist/transcribe`

Multipart: `audio` (a recording) and optional `locale` (`fr` default, or `en`).
Rate limit: 6 per minute per user. Answers `{ text }`. The recording is passed
to the transcription model and dropped.

### 3.4 Error codes

| Code | Status | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No session |
| `VALIDATION_ERROR` | 400 | Text too short, too long or absent |
| `RATE_LIMITED` | 429 | Over the per-user limit |
| `ASSISTANT_UNAVAILABLE` | 503 | No API key |
| `ASSISTANT_FAILED` | 502 | The model call threw or ran out of time, or answered outside the schema |
| `AUDIO_REQUIRED` | 400 | No recording, or an empty one |
| `AUDIO_TOO_LARGE` | 413 | Recording over 4 MB |
| `AUDIO_UNSUPPORTED` | 415 | Not `audio/*`, `video/webm` or `video/mp4` |

## 4. Behaviour

### 4.1 Reading

- The model is `gpt-4o-mini` at temperature 0 with a strict JSON schema. Its
  answer is validated again with Zod; anything outside the form's vocabulary
  is `ASSISTANT_FAILED`, never passed on.
- The person's text is wrapped in `<request>` tags and the prompt says to treat
  it as data. Whatever it says, the answer can only be the schema's fields.
- **Weight.** A stated weight wins and is read exactly as a saved request is
  (`bracketForWeight`): its bracket, with the figure inside it unless it is the
  bracket's ceiling. With no stated weight the model may estimate a bracket for
  an everyday object; between two, the heavier — the direction every bracket
  resolves in (`cargo_input_spec.md`).
- **Size.** Three stated measurements are kept (or read as the preset they
  equal). One or two are not a size: the model's preset estimate is used, or
  nothing.
- A figure outside the form's range (weight > 44 t, a side > 20 m, ≤ 0) is
  dropped, not clamped.

### 4.2 Towns

- The town's name is the model's reading of what the person said. **The postal
  code is never the model's**: it is the one the person gave, if it has the
  country's shape, otherwise the one the map gives for the town's centre
  (`searchAddress` then `reverseGeocode`).
- With no country named, France is searched first, then every country in
  `JOB_COUNTRIES`. With a country named, only that one.
- A town the map cannot find is kept, with a blank postal code and France as
  its country; the Where step asks for the code as it does of anyone.
- A town in a country outside `JOB_COUNTRIES` fills nothing: the end is `null`,
  listed in `missing` and in `outOfArea`, and the box says the country is not
  served.
- No pin is written. A town is not a point; a request posted without a pin is
  placed from its address by `listingPinsService`.

### 4.3 The box

- Before a reading: a text area, « Analyser », and « Dicter » where the
  browser can record.
- After a reading: the six fields with their values — « Dates » reads
  « Enlèvement vendredi 20 novembre · livraison dimanche 22 novembre », or the
  one day that was said — « À préciser » for a missing one, and the text area
  relabelled with the question for the first missing field (« Dans quelle
  ville faut-il le livrer ? »), or « Autre chose à préciser ou à corriger ? »
  when nothing is missing. « Ajouter » reads again with the new line added.
- **« When » is asked last**, after every other field, and is missing while no
  pickup day is known (a delivery day alone still leaves the question).
- « Remplir le formulaire » is disabled when nothing was recognised. It is
  never held for a missing field — not for the days either: the When step has
  dates of its own.
- **The sentence stays in the box until it has been read.** While a reading is
  under way the box is disabled with the text in it; it empties on success. On
  a failure the text is still there, the button reads « Réessayer », and one
  press sends it again. A follow-up answer is kept the same way, with the
  earlier reading still on screen.
- After filling: one line saying the form is pre-filled and nothing is posted
  without the requester, and « Décrire à nouveau ».
- A failure says what to do instead — try again, or fill in the form below —
  and leaves the button usable. A reading that ran out of time (§4.7) has its
  own sentence.

### 4.4 Filling the form (`applyRequestDraft`)

- Only non-null fields are written; anything else keeps what was typed.
- An end is replaced whole: town, postal code, country, no street, no pin,
  `locationEntry: "address"` so the Where step opens on the typed town.
- Once the assistant has filled an end, the address book no longer auto-fills
  the ends (`addressesPrefilled`): it reads an end with a town and no street as
  empty and would write over it. The saved-address picker still works by hand.
- The What step is remounted so its boxes start from the written values.

- A weight or a size the reading wrote counts as the requester's own answer
  from then on: a title suggestion clicked afterwards changes the title only
  (`useCargoChoices`).

### 4.5 Dictation

- Recording stops on « Arrêter » or after 60 seconds. The text is appended to
  the box, where it can be edited before it is read.
- A refused microphone and a failed transcription each have their own message.

### 4.6 Days

- **What is read.** `pickupDate` and `deliveryDate`: a calendar day each, no
  hour. The model is told the day and weekday it is **in France**
  (« Today is Friday 2026-11-20 (Europe/Paris). ») so that « le 20 »,
  « demain » and « vendredi prochain » can be counted from it. A day of the
  month with no month is the next such day, today included. One date with no
  word saying it is the delivery is the pickup. A period with no day (« la
  semaine prochaine », « en mars », « dès que possible ») is not a day: `null`.
- **What is believed** (`statedDates`,
  `src/features/app/create/assistant-dates.ts`, called by the service after
  the model). Each day must be:
  1. shaped `YYYY-MM-DD` and a real calendar date (`2027-02-30` is not);
  2. today or later, **today being the day in Europe/Paris** — the server runs
     in UTC, where it is still yesterday for the first hours of a French
     morning;
  3. no more than twelve months ahead, to the day.

  A day that fails is `null`. **Never guessed, never clamped**: a past day is
  not moved to today, a far one not pulled back. Then the two are compared: a
  delivery before its pickup means one of them was misread and nothing says
  which, so **both** become `null`. The same day at both ends is kept.
- **Why here and not in the form.** `jobFormSchema` may not compare a date with
  the clock (a draft is never refused for how close its pickup is —
  `publication_timing_spec.md`). The assistant's check is about whether to
  believe a model, not about whether a request may go live; once written, the
  days are judged exactly like days typed by hand, by `publication.ts`.
- **Filling the When step** (`timingFromDraft`, called from `applyAssistant`).
  With no day read, the step is not touched at all. Otherwise:
  - the step goes to **Flexible** — the person named a day, not an hour;
  - each stated end becomes a one-day range (« Du » = « Au »), with every
    weekday and every time of day allowed (the defaults);
  - **only the pickup stated**: the delivery keeps what it held unless that is
    now before the pickup, in which case it becomes the day after the pickup —
    the shape `defaultTimingState` has;
  - **only the delivery stated**: the pickup keeps what it held unless that is
    now after the delivery, in which case it becomes the delivery's day;
  - an end kept from « Date précise » whose hidden « Au » lies before its
    « Du » has it brought up to the « Du ».

  The four instants are then derived as for a change made by hand
  (`resolveTimingWindows`), so a pickup stated for today starts at the first
  slot still usable.
- **Never on a resumed request.** Its dates are the ones it was saved with.

### 4.7 Time limits

| Call | Limit | When it runs out |
|---|---|---|
| The model (`MODEL_TIMEOUT_MS`) | 15 s, one try (`maxRetries: 0`) | `ASSISTANT_FAILED` |
| Each map lookup (`MAP_LOOKUP_TIMEOUT_MS`) | 3 s | The town is kept with a blank postal code and no further lookup is made for it — exactly the « not found » case of §4.2. The reading does not fail. |
| Transcription (`TRANSCRIBE_TIMEOUT_MS`) | 20 s, one try | `ASSISTANT_FAILED` |
| The box, for a reading (`ASSISTANT_READ_TIMEOUT_MS`) | 30 s | The box stops waiting, says so (`ASSISTANT_TIMEOUT`, client-side only) and keeps the sentence |

The server's limits add up to less than the box's. The map lookups and the
box's wait are given up on rather than cancelled (`geocoding.ts` and the shared
fetcher take no `AbortSignal`); nothing is written by either, so a late answer
changes nothing.

## 5. Privacy and cost

- The text or recording goes to OpenAI. The box says so, and the privacy page
  lists it under what is collected.
- Each reading is one small model call and up to four map lookups an end; each
  dictation one transcription. The rate limits are per user and in-process
  (`src/lib/rate-limit.ts`), so they are a brake, not a quota.

## 6. Edge cases

| Case | Result |
|---|---|
| Text is not about transport | Every field `null`; « Remplir » disabled |
| Text tries to instruct the model | Read as data; answer is still only the schema |
| One town with no direction | Neither end filled |
| Same town at both ends | Both filled; the Where step's own rules apply |
| Signed out | The availability check answers 401 and the box is not shown |
| No API key | Box not shown; a direct call answers `ASSISTANT_UNAVAILABLE` |
| Model or network failure | `ASSISTANT_FAILED`; the form below is untouched and the sentence is still in the box |
| The reading never answers | After 30 s the box says so; the sentence is still in the box |
| The map is slow | Towns kept without a postal code; everything else is read |
| « le 20 », on the 21st | The 20th of next month (the model's reading), kept if within twelve months |
| A day already gone, or one that does not exist | `null`; « À préciser » |
| Delivery stated before the pickup | Both days `null` |
| Only a pickup day | Delivery default kept, or moved to the day after the pickup |
| A day, and « vers 14 h » | The day is read; the hour is not — the When step asks |
| Browser cannot record | No « Dicter » button |

## 7. Test coverage required

- Service, days: today's date and weekday in the prompt, in Europe/Paris; the
  Paris/UTC boundary (23:30 UTC is tomorrow); past, impossible, too far and
  misshapen days dropped; the twelve-month edge kept; delivery before pickup
  drops both; one bad day leaves the other; `when` missing without a pickup
  day. Time limits: the model call's options; a hanging search and a hanging
  reverse lookup each leave the town unplaced and the reading whole.
- Client API: the 30 s limit, its code, nothing left ticking after an answer.
- Service: vocabulary of the answer; stated weight vs estimate; ceiling weight;
  freight; out-of-range figures; three vs two measurements; postal code from
  the map, from the person, wrong shape; town abroad with and without a named
  country; town not found; country not served; no key; model throws; model
  answers outside the schema; transcription limits and types.
- Routes: 401 on all three; body validation; refusal codes passed through; the
  rate limit, per user.
- Form: every field written in the shape its box holds; nothing written for a
  null; the address book not overwriting a filled town, and still filling when
  no town was found; `timingFromDraft` case by case (§4.6) and the windows the
  form then holds; nothing written onto a resumed request; a weight or size it
  wrote kept against a later title suggestion.
- Box: hidden when unavailable or when the check fails; reading shown before
  anything is written; the follow-up question and the joined text; country not
  served; nothing recognised; failure then retry **with the sentence still in
  the box**, for a first sentence and for a follow-up; the sentence kept while
  reading; the time-out message; the days shown in words; « when » asked last
  and never disabling « Remplir »; rate limit; start over; every label present
  in French and English.
