# Feedback — spec

Every signed-in user can send feedback from the app chrome. Back-office staff
triage what arrives in an admin console. Ported from the sibling Epidom product;
where its conventions conflict with this repo's, this repo wins (§7).

## 1. Data

`feedback_tickets` (migration `0022_feedback`, hand-written — `pnpm db:generate`
is banned here, see CLAUDE.md).

Three enums. **All values are declared in the first migration, in triage order**,
because Postgres orders an enum by declaration order: `ORDER BY status, priority`
*is* the queue order, with no `CASE`. Epidom appended `ARCHIVED` and
`NEEDS_REVIEW` later, so its physical order diverged from its display order
permanently; `shipment_incident_severity` here has the mirror-image bug and needs
an explicit `CASE` to stop the calmest incidents sorting first.

| enum | values |
|---|---|
| `feedback_type` | `bug`, `idea`, `general` |
| `feedback_priority` | `urgent`, `high`, `medium`, `low` (default `medium`) |
| `feedback_status` | `OPEN`, `IN_PROGRESS`, `NEEDS_REVIEW`, `RESOLVED`, `ARCHIVED` (default `OPEN`) |

Columns: `id`, `user_id` (FK → `user`, **ON DELETE SET NULL**), `user_name`,
`user_email`, `user_role`, `type`, `surface`, `pathname`, `description`,
`screenshot_urls` (jsonb array), `app_version`, `locale`, `status`, `priority`,
`dev_note`, `resolved_at`, `resolved_by_user_id`, `created_at`, `updated_at`.

**The ticket outlives the account.** `user_id` nulls on delete, which is why
`user_name`, `user_email` and `user_role` are frozen snapshots taken at submit
time — a report must stay readable after the reporter leaves.

Four deliberate deviations from Epidom's 13 columns:

1. `screenshot_urls` is an array, not one nullable URL. `shipment_incidents.photo_urls`
   is already this shape on the same upload path. Capped at 4.
2. `pathname` alongside `surface`. `surface` is the closed vocabulary the console
   groups by; `pathname` is what reproduces the bug, and our URLs carry the ids
   an engineer needs.
3. `app_version` + `locale`, both server-stamped. This repo bumps `APP_VERSION`
   every session, and FR/EN parity has broken three times.
4. `resolved_at` + `resolved_by_user_id`. Epidom needed an audit-log subsystem to
   answer "who closed this and when"; two columns answer it here.

Not ported: Epidom's `storeId` (no store concept), and Prisma's `@updatedAt`
with no DB default (Drizzle needs `.defaultNow().$onUpdate()`).

Indexes: `(status)`, `(status, created_at)` — the console's default read — and
`(user_id)` for "my feedback". Epidom filters on `userId` with no index on it.

## 2. Boundaries

`submitFeedbackSchema` accepts **only** `type`, `surface`, `pathname`,
`description`, `screenshotUrls`, `locale`. Everything else is stamped by the
service, for the same reason `listings.origin` is absent from
`createListingSchema`: accepting `priority` would let anyone jump the triage
queue, and accepting `userEmail` would let anyone file as someone else.

Two views, and this is the privacy boundary:

- `FeedbackView` (the submitter) — `id`, `type`, `surface`, `description`,
  `screenshotUrls`, `status`, `createdAt`. **No `devNote`** (Epidom returns its
  whole row, so the private note reaches the person it is about), no `priority`,
  no `userEmail`.
- `AdminFeedbackView` — everything, plus a `reporter` that prefers the live
  account and falls back to the frozen snapshot, with `accountExists`.

Enums are **derived** from the pgEnums, never restated (CLAUDE.md §Gotchas 8).

Validation: description 10–2000 chars; ≤4 screenshots; `pathname` must start
with `/` and carry no whitespace; `dev_note` ≤2000. `triageFeedbackSchema`
refuses an empty patch with `TRIAGE_PATCH_EMPTY`.

## 3. Permissions

Enforced in the **service**, never in a route (docs/rules.md §8).

| Operation | Who |
|---|---|
| `submit` | any signed-in user — **no role gate**, that is the requirement |
| `listMine` | the submitter; scoping by `viewer.userId` *is* the authorisation |
| `listQueue` | staff (`isAdmin \|\| isOperator`), else `FORBIDDEN` 403 |
| `triage` | staff, else `FORBIDDEN` 403 |

Staff, not admin-only, matches `shipmentIncidentsService`. Consequence, stated
plainly: `src/proxy.ts` gates `/admin` on `admin` alone, so an operator can call
the API but cannot open the page. That is pre-existing across every admin queue.

Error codes: `UNAUTHENTICATED` 401, `VALIDATION_ERROR` 400,
`FEEDBACK_RATE_LIMITED` 429, `FORBIDDEN` 403, `FEEDBACK_NOT_FOUND` 404.

**`FeedbackError` must be added to the `instanceof` chain in
`src/lib/api-response.ts`.** That file translates only the classes it names;
everything else becomes a bare 500. `PaymentError` was missing until 2026-08-29
and every payment failure reached the browser as an untyped 500.

Abuse brake: ten per hour per **user id** (they are authenticated, so the id is
the honest key). The limiter's counter lives in one instance's heap — a brake on
casual abuse, not a security control.

## 4. Submitting

One `FeedbackLauncher` in the header action cluster of **all three shells** —
`MainLayout`, `DriverLayout`, `AdminLayout`. The header is the only chrome
rendered unconditionally at every width in all three, so one placement covers
desktop and mobile. Not in `Providers` (it wraps the signed-out marketing pages),
not in `BottomNav` (six slots, already full), not a floating button (it would
land on the fixed bottom nav).

**No role gate on the launcher.** `HeaderQuickActions` returns `null` for
non-drivers, which is exactly the complaint that a new signup sees an empty
header. Everyone reaching these shells is signed in.

Second door: a `sendFeedback` entry in the profile quick links, beside Help.

Dialog: two tabs — *New* and *My feedback*. Four fields: type, surface (a
`Select` pre-selected by **longest-prefix** match of `usePathname()`, which
matters because `/carrier/trips` and `/carrier/application` share a prefix and
`/listings/me` and `/listing/:id` differ by one character), description, and up
to four screenshots uploaded on pick.

Auto-attached and never shown: `pathname`, `locale` from the client; `userId`,
`userName`, `userEmail`, `userRole`, `appVersion` from the server. Deliberately
**not** collected: user agent, viewport, console or network logs, any screen
capture.

Submitting is one derived `isSubmitting` that disables every control, and the
dialog refuses to close while it runs — including from Cancel, which Epidom's own
guard misses. Success replaces the body with a reference `#XXXXXXXX`. The history
tab renders no submit button: `TabsContent` unmounts the form, so a footer button
targeting it by `form=` is a silent no-op.

## 5. The console

`/admin/feedback`, plus entries in **both** hand-maintained admin nav lists and a
sidebar badge counting `OPEN` + `NEEDS_REVIEW` (Epidom counts `OPEN` alone and so
hides every ticket an admin bounced back).

Five status tiles as toggle filters. **Counts come from the server**, folded into
the queue response so the tiles can never disagree with the list; Epidom counts
its fetched top-500 in the browser, so past 500 tickets the tiles are silently
wrong.

Filters — type, priority, search, clear — are all server-side. Search matches
description, name, email and an exact id, so an operator can paste a `#REF`.
No sort control is needed: `ORDER BY status, priority, created_at DESC`
reproduces Epidom's default grouping for free, because both enums are declared in
triage order.

Rows carry inline status and priority `Select`s that write immediately, a
"Show more" toggle above 200 characters, screenshot thumbnails, one muted meta
line, and the dev-note editor. Any status may follow any status — a triage board
is not a state machine, and refusing `ARCHIVED → OPEN` would strand tickets.
Moving **into** `RESOLVED` stamps `resolved_at`/`resolved_by_user_id`; moving out
clears them.

Polls every 30s and on window focus.

## 6. Scope

**In v1:** the five tiles, the filters, one paginated card list, inline triage,
the dev-note editor, show-more, click-to-copy, polling, the badge.

**Refused, ~800 of Epidom's 1374 console lines:** the Table view (nine columns
plus a full card-stack fallback below `lg` — two renderings of one dataset,
permanently drifting; the card list *is* that fallback), the Board view (no
drag-and-drop even in Epidom — a five-column re-layout plus a second filtered set
and a dimming rule that exist only to serve it), the Feed view (the list sorted
by date, which the default ordering already gives), the view switcher, the
localStorage persistence those views forced, the detail dialog and lightbox, and
user-side edit/delete.

Honest cost: an operator cannot see all five statuses side by side. The tiles
give the same information in one row, one click from any of them.

User-side edit/delete is refused on merit, not effort: editing a report an
operator has already dev-noted invalidates the note, and deleting it destroys the
record of a bug.

## 7. Rulings against Epidom

1. **Hardcoded admin email allowlist** → `user_roles` + `resolveViewer()`.
2. **Enums restated three times** → derived from the pgEnum once.
3. **Two response envelopes** → one `ok`/`fail`, one `ApiError`.
4. **`take: 500`, filtering in the browser** → filter, sort, count, paginate in the DAL.
5. **localStorage filter/view persistence** → deleted with the views.
6. **Whole row to the submitter** → `toFeedbackView`, asserted by a DTO test.
7. **Vercel Blob + a hostname refine** → R2. The real analogue of that guard is
   the image-cleanup cron: **`screenshot_urls` must be declared in
   `image-cleanup.service.ts`** or every screenshot is an orphan by construction
   and the Sunday sweep deletes it.
8. **`var(--app-zoom)` calc divisors** → `max-h-[90vh]`; that variable does not exist here.
9. **Dark-tuned raw palette classes** → tokens, or an explicit `light dark:` pair.
10. **Prisma `@updatedAt` with no DB default** → `.defaultNow().$onUpdate()`.
11. **The board's two filtered sets** → gone with the board.
12. **Inngest fan-out** → `notificationsService`, in its own `try`.
13. **Hardcoded English and `en-GB` dates** → both catalogues, written as we go.

## 8. Test coverage required

- **DTO** — `toFeedbackView` emits an exact allowed key set; a named forbidden
  list (`devNote`, `userEmail`, `priority`, …) asserted one by one; the live
  account beats the frozen snapshot and falls back when absent; length and count
  limits at their boundaries; client-sent `status`/`priority`/`devNote` stripped;
  **each Zod enum deep-equals its pgEnum** (catches a future hand-copied list);
  `TRIAGE_PATCH_EMPTY`; query coercion and clamping.
- **Service** — the stamps come from the session, not the input; **the ticket
  survives a failing announce**; announce dedupes an admin-and-operator into one
  notification; `listMine` scopes by viewer; `listQueue`/`triage` throw
  `FORBIDDEN` for non-staff and do not touch the DAL; counts zero-fill all five
  statuses; `RESOLVED` stamps, re-`RESOLVED` does not re-stamp, leaving clears.
- **`api-response`** — a `FeedbackError` answers its own code and status, not 500.
- **Submit UI** — submit disabled at 9 characters and enabled at 10; longest-prefix
  surface defaulting; unknown path → `other`; **every dynamic `t()` key resolves
  in both catalogues with an `onError` spy**; the history tab has no submit
  button and its failure renders a retry, not a blank panel.
- **Console UI** — tiles render server counts including a zero; a tile toggles;
  `isError` renders an empty state, never a blank page; filtered-empty differs
  from empty; the dev-note editor collapses correctly.
- **Existing suites** — `migrations-journal` and `locale-parity` must pass
  untouched; both will fail on a mistake here.
