# Request assistant — describe a request, the form fills itself

Release 2.86.0. Plan: `docs/plans/plan_request_assistant.md`.

The owner's ask, 2026-11-16: *« Could we use an AI tool about talk to it for
adding a new ad (when customer is connected) with the name and size of the item
and also picking and delivery cities? »*

## 1. What it is

A box at the top of `/create`, step « Quoi ». A signed-in requester types or
dictates a sentence — « un canapé 3 places de Lyon à Bordeaux » — and gets back
a reading: the item, its size, its weight, the pickup town and the delivery
town. « Remplir le formulaire » writes that reading onto the form.

## 2. What it is not

- **It never creates, saves or publishes a request.** The assistant's only
  output is values for the form. The requester still walks the four steps and
  presses « Publier »; every rule in `jobFormSchema` and `createListing` still
  decides what reaches the board.
- It does not set dates, a budget, a street, a pin, a contact, photos or
  `origin`. None of those are in its answer's shape.
- It is not offered on a move (`?type=moving`) or on a request being resumed.
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
| `missing` | Subset of `title, size, weight, pickup, dropoff`, in that order |
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
| `ASSISTANT_FAILED` | 502 | The model call threw, or answered outside the schema |
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
- After a reading: the five fields with their values, « À préciser » for a
  missing one, and the text area relabelled with the question for the first
  missing field (« Dans quelle ville faut-il le livrer ? »), or « Autre chose à
  préciser ou à corriger ? » when nothing is missing. « Ajouter » reads again
  with the new line added.
- « Remplir le formulaire » is disabled when nothing was recognised.
- After filling: one line saying the form is pre-filled and nothing is posted
  without the requester, and « Décrire à nouveau ».
- A failure says what to do instead — try again, or fill in the form below —
  and leaves the button usable.

### 4.4 Filling the form (`applyRequestDraft`)

- Only non-null fields are written; anything else keeps what was typed.
- An end is replaced whole: town, postal code, country, no street, no pin,
  `locationEntry: "address"` so the Where step opens on the typed town.
- Once the assistant has filled an end, the address book no longer auto-fills
  the ends (`addressesPrefilled`): it reads an end with a town and no street as
  empty and would write over it. The saved-address picker still works by hand.
- The What step is remounted so its boxes start from the written values.

### 4.5 Dictation

- Recording stops on « Arrêter » or after 60 seconds. The text is appended to
  the box, where it can be edited before it is read.
- A refused microphone and a failed transcription each have their own message.

## 5. Privacy and cost

- The text or recording goes to OpenAI. The box says so, and the privacy page
  lists it under what is collected.
- Each reading is one small model call and up to four map lookups; each
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
| Model or network failure | `ASSISTANT_FAILED`; the form below is untouched |
| Browser cannot record | No « Dicter » button |

## 7. Test coverage required

- Service: vocabulary of the answer; stated weight vs estimate; ceiling weight;
  freight; out-of-range figures; three vs two measurements; postal code from
  the map, from the person, wrong shape; town abroad with and without a named
  country; town not found; country not served; no key; model throws; model
  answers outside the schema; transcription limits and types.
- Routes: 401 on all three; body validation; refusal codes passed through; the
  rate limit, per user.
- Form: every field written in the shape its box holds; nothing written for a
  null; the address book not overwriting a filled town, and still filling when
  no town was found.
- Box: hidden when unavailable or when the check fails; reading shown before
  anything is written; the follow-up question and the joined text; country not
  served; nothing recognised; failure then retry; rate limit; start over;
  every label present in French and English.
