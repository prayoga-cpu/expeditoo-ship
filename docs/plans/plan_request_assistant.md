# Plan — request assistant on `/create`

Spec: `docs/specs/request_assistant_spec.md`. Release 2.86.0. No migration.

## Goal

A signed-in requester describes a request in a sentence, typed or dictated, and
the form opens with the item, its size and weight and the two towns filled.
The assistant fills the form; it never posts.

## Decisions

- **Reuse OpenAI**, already in the repo (`src/lib/ai/openai.ts`,
  `OPENAI_API_KEY`). No new provider, no new dependency.
- **Guided fill, not a chat.** One reading, a question for what is missing, and
  the form. Stateless on the server.
- **Text and dictation** in the same box.
- **Towns are looked up**, not trusted: the postal code comes from the map.

## Steps

1. `src/server/dto/request-assistant.dto.ts` — the request and the answer.
2. `src/server/services/request-assistant.service.ts` — model call, strict
   schema, normalising into brackets and presets, town lookup, transcription.
3. Routes: `GET|POST /api/listings/assist`,
   `POST /api/listings/assist/transcribe`; `RequestAssistantError` registered
   in `src/lib/api-response.ts`.
4. Client: `create/api/assistant.api.ts`, `create/assistant.ts`
   (`applyRequestDraft`), `hooks/useRequestAssistant.ts`,
   `hooks/useVoiceInput.ts`, `ui/RequestAssistant.tsx`.
5. `useJobForm.applyAssistant` and the box in `JobForm`, step « Quoi » only,
   not on a move or a resumed request.
6. Copy: `create.assistant.*` in both languages; one line on the privacy page.
7. Tests per spec §7; a pass in Chromium against the real model.

## Dependencies

- `OPENAI_API_KEY` in the environment. Without it the box is not shown.
- Nominatim, as every other lookup here.

## Not in this release

- A full back-and-forth conversation.
- Dates, budget and photos read from the sentence.
- Moves (`?type=moving`).
- A shared-storage rate limit.
