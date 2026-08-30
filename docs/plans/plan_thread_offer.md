# Plan — A price offer inside the message thread

**Spec:** `docs/specs/thread_offer_spec.md`
**Date:** 2026-08-29

The client asked for two things: a form that sends a price with pickup and
delivery dates from the transporter, and a button inside the message thread that
opens it. Confirmed with them: the button goes on **every** thread, and the
recipient accepts **inside the chat**.

---

## 1. The shape of the answer

An offer in a thread is a `thread_offers` row plus an ordinary `messages` row
pointing at it. `messages.thread_offer_id IS NOT NULL` is the discriminator —
no message-kind enum, no JSON blob.

When the thread is about an open job, the same submit **also** creates a real
`offers` row through `offersService.submitOffer`, so the chat feeds the existing
reverse auction instead of shadowing it. Accepting in the bubble then calls
`offersService.acceptOffer`, the one money path.

The chat offer proposes **one** slot, not up to twelve. That is the whole reason
accept-in-bubble is safe — `acceptOffer` already documents that a one-slot offer
"need name nothing", so no `slotId` is passed and no wrong slot can be booked.

---

## 2. Schema

1. `src/db/schema/thread-offers.ts` — new table, `thread_offer_status` pgEnum,
   relations. Reuses the existing `time_slot` pgEnum for the period.
2. `src/db/schema/messages.ts` — add `threadOfferId` + relation.
3. `src/db/schema/index.ts` — export the new module.
4. `src/db/migrations/00NN_thread_offers.sql` — **hand-written**. Do not run
   `pnpm db:generate`: `meta/` holds snapshots only for `0000`/`0001`, so
   drizzle-kit would diff against `0001` and re-emit every hand-written
   migration since `0002`.
5. `meta/_journal.json` — append with `idx` contiguous, a unique 4-char prefix
   and a `when` strictly greater than the last entry. **Check the current tail
   at the moment of writing** — another session has been landing migrations, and
   a backdated entry is silently skipped by drizzle.

---

## 3. Server

| File | Change |
|---|---|
| `src/server/dto/thread-offers.dto.ts` | **new** — `createThreadOfferSchema`, derived from `TIME_SLOTS`, never restating it |
| `src/server/dal/thread-offers.dal.ts` | **new** — permission-blind CRUD |
| `src/server/services/thread-offers.service.ts` | **new** — `ThreadOfferError`, `contextFor`, `submit`, `accept`, `decline`, `withdraw` |
| `src/server/services/message-publish.ts` | **new** — the Ably block lifted out of `sendMessage` verbatim, so both services publish identically. Its own module, because `messages.service` imports the thread-offer service and the reverse would be a cycle |
| `src/server/services/messages.service.ts` | `getThread` returns `offerContext`; `sendMessage` calls the extracted publisher |
| `src/server/dal/messages.dal.ts` | `getMessages` joins the thread offer; `getConversationById` **narrows** its listing select |
| `src/server/dto/ably-events.dto.ts` | `threadOfferId` optional on `newMessageEventSchema` |
| `src/lib/api-response.ts` | register `ThreadOfferError` |
| `src/app/api/messages/conversations/[id]/offer/route.ts` | **new** POST |
| `src/app/api/messages/offers/[id]/{accept,decline,withdraw}/route.ts` | **new** POST ×3 |

`getConversationById` is a `findFirst` with no `columns` clause today, so the
whole listings row — `budgetCents`, `shipperId`, addresses, `origin`,
`externalRef` — ships to every thread participant. This feature starts depending
on that row, so narrow it in the same change rather than building on the leak.

---

## 4. Client

| File | Change |
|---|---|
| `src/features/app/messages/types.ts` | `ThreadOfferView`, `ThreadOfferContext`, `ChatMessage.offer` |
| `src/features/app/messages/api/messages.api.ts` | four calls + `offerContext` on the thread response |
| `src/features/app/messages/hooks/useThreadOffer.ts` | **new** — mutations, i18n'd error mapping |
| `src/features/app/messages/hooks/useMessageDetail.ts` | map `offer` onto `ChatMessage`; Ably refetch branch; the `photos` fix |
| `src/features/app/messages/ui/ThreadOfferAction.tsx` | **new** — self-gating trigger |
| `src/features/app/messages/ui/ThreadOfferDialog.tsx` | **new** — the form |
| `src/features/app/messages/ui/ThreadOfferSlotField.tsx` | **new** — one day + one period + delivery lead |
| `src/features/app/messages/ui/ThreadOfferBubble.tsx` | **new** — the card |
| `src/features/app/messages/ui/MessageDetail.tsx` | the button in the composer row; the bubble branch in the message map |

`ThreadOfferSlotField` is **not** `OfferSlotsField`. That component is
multi-day and requires a job window; the chat needs exactly one slot and has no
window on the standalone lane. It reuses the same lib helpers and the same
`listing.bid.slots.slot.*` translations, so the vocabulary does not drift.

Two adjacent fixes, both in files this change already edits:

- `useMessageDetail` reads `conversation.listing?.images?.[0]?.url`, but the DAL
  returns the relation as `photos` — so the thread has **always** rendered the
  📦 placeholder. One line.
- No thread page consumes the hook's `error`, so a failed fetch renders an empty
  chat titled "Chargement…" with no retry (CLAUDE.md gotcha 9). This is exactly
  the failure mode an unapplied migration would produce, so it lands **first**.

---

## 5. Translations

New block `messages.offer.*` in both `messages/en.json` and `messages/fr.json`,
inserted after `messages.detail`. Reuse, do not re-add:
`listing.bid.form.*` (vehicle/price/message field copy),
`listing.bid.slots.slot.*` (the three periods),
`listing.bid.errors.*` (four failures that already have wording).

Both files in the same commit — `src/i18n/__tests__/locale-parity.test.ts`
enforces identical leaf paths and rejects empty strings. **Do not run
Prettier**: `.prettierc` is misnamed, so it never loads and reformats whole
files.

---

## 6. Order of work

1. The `isError` branch on the thread pages (so step 4 cannot fail invisibly).
2. Schema + hand-written migration + journal entry; run
   `src/db/__tests__/migrations-journal.test.ts`.
3. DTO → DAL → service → routes, with the service test alongside.
4. Client API → hook → UI, with the UI tests alongside.
5. Translations, then `locale-parity.test.ts`.
6. Gates: `npx tsc --noEmit`, `pnpm lint`, `pnpm test`. Scope tsc/lint reporting
   by path — another session is editing this tree concurrently.
7. **Deploy note:** nothing in CI runs migrations and Vercel runs a plain
   `next build`. Production needs `MIGRATE_TARGET=production pnpm db:migrate`
   run by hand **before** the code deploys, or `getMessages` selects a column
   that does not exist and every thread 500s.

---

## 7. Deliberately not done

Listed in full in the spec, §11. The three worth repeating: no multi-slot chat
offer and therefore no slot picker in the bubble; no withdraw-then-resubmit
"revise" flow, because it is non-atomic and can strand a carrier with no offer;
and no fix for `POST /api/messages`'s missing participation check, which is
pre-existing, out of scope, and now worth filing loudly because a thread carries
prices.
