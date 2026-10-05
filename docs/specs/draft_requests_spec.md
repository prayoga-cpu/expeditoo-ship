# Spec — finishing a saved request: resume, publish, delete

**Plan:** `docs/plans/plan_draft_requests.md` · **Release:** 2.60.0

**Approved by the owner (2026-10-05):** "implement these full logics feature,
build the screens, and make it possible" — for 2.59.0's known limit: a saved
draft could not be published, edited or deleted. Extras approved: scheduled
requests are handled the same way, and a request records the day it really went
live. Not in scope: editing a request already published.

## 1. What can be done, where

| Request | « Mes demandes » card and its own page offer |
|---|---|
| `draft` | « Reprendre » (the form, pre-filled, from step 1) · « Publier » (the form, pre-filled, on the Budget step) · « Supprimer » (after a confirmation) |
| `scheduled` | « Modifier » · « Publier maintenant » (Budget step, « Maintenant » selected) · « Repasser en brouillon » · « Supprimer » |

Publishing always goes **through the form's Budget step**: only the browser can
re-derive a flexible window from the current time in the requester's own zone
(`timing.ts`), and that step shows the publication notices and the choice of
when to publish. The actions sit **outside** the card's link (a button inside a
link is not a button).

A draft's own page (`/listing/:id`, owner only) shows a banner — « Brouillon —
pas encore visible par les transporteurs. » or « Planifiée — publication le
{date}. Invisible des transporteurs d'ici là. » — with the same actions, and no
offers section. A draft whose last pickup moment has passed adds « Dates
passées — à mettre à jour ».

« Repasser en brouillon » pressed on that page changes **that page**: the copy
it observes (`['job', id]`) is rewritten in place with the view the endpoint
returns, then re-read, so the banner, the badge and the actions become the
draft's at once. Removing the copy instead re-rendered nobody — the page kept
saying « Planifiée » beside a toast saying the opposite, and a second press got
a 409 (found in review). « Supprimer » leaves the page for « Mes demandes », and
only that drops the copy.

The page says « Demande introuvable » only for a **404 or a 403**. Any other
failure — the network, a 500 — is « Impossible de charger cette demande » with
« Réessayer », never a claim that the request was removed; a copy already on
screen stays when a later read fails that way.

## 2. Resuming — `/create?draft=<id>[&step=budget]`

- `create/page.tsx` reads the query on the server (no `useSearchParams` trap)
  and requires a session. Signed out, it sends to `/signin` with the **whole**
  link — `draft`, `step` and `publish` — encoded in `callbackUrl`, so
  « Publier maintenant » would come back to the Budget step with « Maintenant »
  chosen. (`/signin` does not read `callbackUrl` yet: it lands on `/home`
  whatever is asked. The link is kept whole for the day it does.)
- `GET /api/listings/:id/draft` loads the request (owner only, `draft` or
  `scheduled`); 404 for anyone else; **409 `LISTING_NOT_DRAFT`** once it has
  gone live, and the form then hands over to `/listing/:id` — after marking
  that page's cached copy and the list stale, or a copy read under a minute ago
  would still show it unpublished. A 404 marks the same two copies stale and
  stays: deleted in another tab, the request must not live on in the list
  « Demande introuvable » links back to.
- It is read **once**. The form is seeded from that copy and never reads a later
  one, so nothing refetches it — not a window focus, not a reconnect: a
  reconnect whose read failed used to swap the form for « Demande introuvable »,
  unsaved edits and all. Opened offline, the read waits (a loader), it does not
  fail. « Demande introuvable » is for a 404 or a 403 only; any other failure is
  « Impossible de charger cette demande » with « Réessayer ».
- `fromListing(row, locale, now)` (`create/from-listing.ts`, pure) rebuilds the
  form:

| Stored | Form | Lossy, and how |
|---|---|---|
| `weightKg` | the bracket whose ceiling it equals; otherwise the smallest bracket above it plus `exactWeightKg`; above 1000 → `over1000` + the figure | `notSure` and `upTo500` both store 500 → `upTo500`; same number |
| dimensions | none → preset mode, nothing picked; a preset's exact dimensions → that preset; otherwise exact mode | a typed size equal to a preset reads as that preset; same numbers |
| `description` | with `isFragile`, split at the last `"\n\nFragile: "` into description and `fragileNote` | **required**, or every save would add another suffix |
| endpoints | address, city, postal code, coordinates, location type, floor, lift, note, contacts; « Enregistrer cette adresse » off | a pasted map link comes back as its pin, with its note |
| exact time | the local day and time of `pickupFrom` (and `dropoffFrom`), in its time of day; a time on that time of day's half-hour list as it is, any other **snapped to the nearest choice on it** — a tie goes to the later, a moment the requester had said they would be there; a time outside the list's hours takes its nearest end (05:00 → 06:00, 22:30 → 21:30) | only a time saved before the list existed, when the form took any minute: it moves by up to 15 min, or to the list's end. The form then opens on the **When step**, whatever step was asked for (`step=budget` included), above a notice naming the saved time and the one selected — shown while that time stays selected — so « Publier » never posts a time the requester did not see. The same holds for a **window other than the form's one hour** (an exact request saved before that window existed, e.g. 09:00–17:00): the form can only hold one hour, so it names both as ranges (« 09:00–17:00 » → « 09:00–10:00 ») |
| flexible time | the local days of `pickupFrom` and `pickupUntil`, the stored weekdays and times of day | the range may come back narrower at an unticked end; carriers see the same window |
| `budgetCents` | `budgetEuros` text in the locale (`centsToInput`) | — |
| photos | their URLs in order | — |
| `scheduledPublishAt` | for a `scheduled` request still in the future: « Planifier » at that moment; otherwise « Maintenant » | a draft keeps no schedule (`publication_timing_spec.md` §2) |

- The form opens titled « Reprendre ma demande », with every step already
  reached (`furthestStep` = 3: a saved request passed the whole schema).

## 3. Saving — `PUT /api/listings/:id/draft`

The body is exactly `createListingSchema` (every cross-field rule applies,
`publish` and `scheduledPublishAt` included). `listingsService.saveDraft`:

1. Re-classifies: `publish: false` → `draft` (no schedule, placeholder
   `expiresAt`); `publish` with a future schedule → `scheduled`; `publish` now →
   `open` with `publishedAt = now`. Publication rules run exactly as on create
   (`assertPublishable`).
2. Writes with **one conditional update** — `WHERE id AND shipper_id AND status
   IN ('draft','scheduled')` — so a second tab, a double click or a delete in
   between cannot both win: no row → re-read → 404 or **409
   `LISTING_NOT_DRAFT`**.
3. Writes **every** field the form decides, optional ones included: a size,
   floor, lift, note, contact or packaging state the requester cleared is
   written `null`, and an absent availability set is written as the full set.
   An insert reads an undefined column as its default, but an update skips it
   — so a cleared field kept its old value, and « Déjà emballé » survived
   beside « À emballer » (`toColumns`, shared with `createListing`; found in
   review).
4. Replaces the photo set.
5. Keeps the request's id, reference, category, origin and `createdAt`.
6. When it went live now, announces it exactly as a new request does (bell,
   email, carrier route alerts) — once, by the winning write only. The form then
   lands on the thank-you page, after dropping its cached copy of the draft.

## 4. Deleting and un-scheduling

- `DELETE /api/listings/:id/draft` — hard-deletes a `draft` or `scheduled`
  request of the caller's, with one conditional delete; 404 / 409 as above.
  Photos go with it (foreign-key cascade).
- `POST /api/listings/:id/unschedule` — `scheduled` → `draft`, schedule cleared;
  409 `LISTING_NOT_SCHEDULED` otherwise.
- `listingsService.publishListing` (no route ever called it) is removed.
- The confirmation reads « Supprimer ce brouillon ? » or « Supprimer cette
  demande planifiée ? » above one description that agrees with both: « Cette
  demande sera supprimée définitivement. Aucun transporteur ne l'a encore vue. »
  (« Elle sera supprimée… » had no antecedent under the draft's title).

What the requester is told when the server refuses (`draftRefusal`,
`useDraftActions.ts`) — each true whatever happened in between, and none of
them « réessayez », which no retry could make good:

| Refusal | Message | Then |
|---|---|---|
| 404 — deleted meanwhile, in another tab | « Cette demande est introuvable : elle a peut-être été supprimée entre-temps. » | the list and the page's copy are refreshed |
| 409 `LISTING_NOT_SCHEDULED` — un-scheduled, published or expired meanwhile | « Cette demande n'est plus planifiée. » | same |
| 409 `LISTING_NOT_DRAFT` — published or closed meanwhile (`open`, `expired`, `cancelled`) | « Cette demande a été publiée ou fermée entre-temps : elle ne peut plus être modifiée ici. » | same |
| anything else | « Impossible d'effectuer cette action. Veuillez réessayer. » | — |

A save from the form (`PUT …/draft`) answers the same way: a 404 keeps the
form, and what was typed with it; a 409 hands over to `/listing/:id` with that
page's copy refreshed. « Cette demande vient d'être publiée » is gone: it was
said for every 409, including a request un-scheduled in another tab or expired
by the scheduler, neither of which ever went live.

## 5. The real publication date — migration `0036_listing_published_at`

- `listings.published_at timestamp NULL`: set when a request first goes live —
  publish now (`createListing`, `saveDraft`) and the scheduler
  (`publishScheduled`). Re-boarding keeps it.
- Back-fill: `published_at = created_at` for every row not `draft` or
  `scheduled`. That includes the few rows that never went live at all — a
  scheduled request the scheduler expired because its bidding window had
  closed, or one cancelled while still scheduled. Nothing on such a row tells
  it apart from one that was live, so the back-fill cannot leave it out; from
  0036 on, those two paths leave the column null.
- The board's « Plus récentes » orders by `published_at`, ties settled by the
  unique `reference` — as every board sort is now: one scheduler run publishes
  its batch at one instant, and rows that sort equal have no stable order
  between two `LIMIT`/`OFFSET` pages. « Mes demandes »
  reads « Publiée le {publishedAt} » — **only** when `publishedAt` is set —
  « Enregistré le {updatedAt} » for a draft and « Publication prévue le
  {scheduledPublishAt} » for a scheduled one. A request that never went live
  reads « Créée le {createdAt} »: falling back to `createdAt` under « Publiée
  le » named a day on which nothing was published (found in review).
- `publishScheduled` decides each due request **under its row lock**
  (`lockDueScheduled`: `SELECT … FOR UPDATE SKIP LOCKED`, only while still
  `scheduled` and due), inside one transaction per request, and re-derives
  `expiresAt` from the locked row. A request un-scheduled, deleted or
  published by hand meanwhile no longer matches; one re-scheduled for later or
  given a new pickup is read as saved; one being saved this instant is skipped
  until the next run. The bell and the route alerts are built from the row as
  written, never from the copy the run read first.
- Classified `public` in `listing-view.ts` (`listing_privacy_spec.md` §2).

## 6. Error codes

| Case | Code | The requester reads |
|---|---|---|
| not signed in | 401 | `/create` sends to `/signin` first; a session lost later: the form's load failed, « Réessayer »; the actions' « Impossible d'effectuer cette action… » |
| missing, or someone else's | 404 `LISTING_NOT_FOUND` | « Demande introuvable » (page, form); « Cette demande est introuvable… » (actions, save) |
| no longer a draft or scheduled | 409 `LISTING_NOT_DRAFT` | « …publiée ou fermée entre-temps… » (actions, save); the form hands over to the page |
| un-scheduling a request that is not scheduled | 409 `LISTING_NOT_SCHEDULED` | « Cette demande n'est plus planifiée. » |
| invalid body | 400 `VALIDATION_ERROR` | the form's own failure toast |
| publication rules | 400 `PICKUP_IN_PAST` / `PICKUP_TOO_SOON` / `SCHEDULED_PUBLISH_IN_PAST` | already handled by the form |

## 7. Test coverage required

- `from-listing.test.ts`: `toCreatePayload(fromListing(row))` gives back the
  stored row for every bracket, **every preset** (`SIZE_PRESET_IDS`, picked as
  that preset), fragile note, exact and flexible timing, a scheduled request;
  the fragile suffix never doubles. An exact time off the list moves to the
  nearest choice and is named — 09:15 → 09:30, 22:30 → 21:30, 05:00 → 06:00,
  a delivery time too — while one on the list stays and is not named; built
  with local constructors, so it holds in any timezone.
- `listings.service.test.ts`: `saveDraft` as draft / scheduled / published
  (one announcement, `publishedAt` set), photos replaced, publication rules
  skipped for a draft, 404 and 409 on a lost race, every optional column
  written (`null` or the full set) so a cleared field is cleared;
  `deleteDraft`; `unschedule`; `publishScheduled` locks each row in a
  transaction, works from the locked row and leaves one no longer scheduled
  and due alone; `createListing` stamps `publishedAt` only when live now.
- `listings-browse.dal.test.ts`: every board sort ends on the reference.
- `useJobForm.test.tsx`: a resumed draft saves with PUT, publishing lands on the
  thank-you page; a moved time opens the When step whatever step was asked for
  and stops being named once another is picked; a 404 on save says not found,
  not « réessayez », and keeps the form; a 409 says published or closed, marks
  the page's copy stale and hands over to it.
- `SnappedTimeNotice.test.tsx`: the real form, asked for the Budget step, opens
  on « Quand » with the notice naming both times — and opens where asked, with
  no notice, when every time is on the list.
- `DraftForm.test.tsx`: the form survives a reconnect whose read would fail
  (read once); an offline first read waits; a 404 is « introuvable » and marks
  the list and the page's copy stale without leaving; any other failure is a
  failed load whose « Réessayer » reads again; a 409 hands over with the
  page's copy marked stale.
- `create/__tests__/page.test.tsx`: signed out, the `callbackUrl` keeps `draft`,
  `step` and `publish`, encoded whole.
- UI: draft and scheduled cards show their actions outside the link and their
  dates — « Créée le », never « Publiée le », on a request that never went
  live; the delete asks first; each refusal says its own message, and a
  failure worth a retry still says « réessayez » (`DraftActions.test.tsx`); the
  draft page shows its banner and no offers; un-scheduling from the page shows
  the draft's banner, and a 409 there says « n'est plus planifiée » and shows
  what the request is now (`JobDetailUnschedule.test.tsx`, the real page, hooks
  and actions over the app's cache defaults); the page says « introuvable » for
  a 404 or a 403 only, and a failed load with « Réessayer » otherwise
  (`JobDetail.test.tsx`).
- `migrations-journal.test.ts` passes with `0036`; locale parity.
