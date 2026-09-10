# Plan — In-app feedback

## Why

Nobody inside the product can tell us anything. Bugs arrive as screenshots in
chat, get triaged in someone's head, and are never seen again by the person who
reported them. The client asked for two things: a way for **every** signed-in
user to send feedback from the dashboard, and an **admin-only** console to work
through what arrives — modelled on the sibling Epidom product, which has run
this exact feature for three months.

Epidom is Prisma on a different stack. We port its **design**, not its code.
Where its conventions and ours disagree, ours win; §7 of the spec lists each
conflict and the ruling.

## Steps

1. `src/db/schema/feedback.ts` + hand-written `0022_feedback.sql` + journal entry.
   All five statuses and all four priorities declared up front, in triage order.
2. `src/server/dto/feedback.dto.ts` — schemas derived from the pgEnums, and the
   two view mappers that are the privacy boundary.
3. `src/server/dal/feedback.dal.ts` — permission-blind, with server-side filter,
   sort, paginate and the status counts.
4. `src/server/services/feedback.service.ts` — where the staff check lives.
   Register `FeedbackError` in `api-response.ts`.
5. Routes: `POST|GET /api/feedback`, `GET /api/admin/feedback`,
   `PATCH /api/admin/feedback/[feedbackId]`.
6. Client API + hooks under `src/features/app/feedback/`.
7. `FeedbackLauncher` + `FeedbackDialog`, mounted in all **three** app shells.
8. `FeedbackConsole` + `/admin/feedback` + both admin nav lists + the sidebar badge.
9. `feedback` i18n namespace in both catalogues.
10. **Declare `screenshot_urls` in `image-cleanup.service.ts`** — without it the
    Sunday sweep deletes every screenshot.
11. Tests, gates, release, operator to-do for the migration.

## Dependencies

- `POST /api/upload` → R2 public bucket (`R2_BUCKET_NAME`), already used by incidents.
- `notificationsService.createNotification` for the staff fan-out.
- `rateLimit()` from `src/lib/rate-limit.ts`.
- `primaryRole()` for the frozen role snapshot.

## Out of scope (v1)

Epidom's Table and Board views, its Feed view, the view switcher, localStorage
filter persistence, the detail dialog, the screenshot lightbox, and user-side
edit/delete. Reasoning in spec §6.
