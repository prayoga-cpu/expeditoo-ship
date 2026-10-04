# Spec — when a request may be published, and what the form says about it

**Plan:** `docs/plans/plan_create_form_feedback.md` · **Release:** 2.59.0

**Reported (2026-10-02, v2.58.0, `/create`):** clicking « Enregistrer le
brouillon » showed, bottom right, « Le retrait est trop proche pour laisser le
temps d'enchérir. Reportez-le. » — "has to be changed: warning about dates of
pickup and publish too close".

## 1. The rule, written once

`src/lib/listing-window.ts` (pure, imported by the service and the form):

| Export | Meaning |
|---|---|
| `expiresAtFor(pickupFrom, publishAt)` | **Unchanged.** Bidding closes 6 h before pickup; a job published later than that gets `publishAt + 30 min`; `null` when even that is after `pickupFrom`. |
| `earliestPickupFor(publishAt)` | `publishAt + MIN_BIDDING_WINDOW_MS` (30 min): the earliest pickup a publication at `publishAt` can carry. |
| `publicationProblem(pickupFrom, publishAt, now = new Date())` | `"PICKUP_IN_PAST"` when `pickupFrom <= now`; else `"PICKUP_TOO_SOON"` when `expiresAtFor(pickupFrom, publishAt)` is `null`; else `null`. |

The 6 h – 6 h 30 band, where `expiresAtFor` returns a deadline under 30 minutes
away, is **not** changed: re-boarding is tested against it
(`offers.service.test.ts`, "refuses to re-board into a window too short to bid
in"). The form reports the real deadline instead (§3.2).

## 2. Server — `listingsService.createListing`

| `publish` | Checks (in this order) | `expires_at` | `scheduled_publish_at` |
|---|---|---|---|
| `true` | `PICKUP_IN_PAST` (`pickupFrom <= now`) → `SCHEDULED_PUBLISH_IN_PAST` (`scheduledPublishAt <= now`) → `PICKUP_TOO_SOON` (via `resolveExpiresAt(pickupFrom, scheduledPublishAt ?? now)`) | the resolved deadline | as sent |
| `false` (draft) | **none of the three** | `expiresAtFor(pickupFrom, now) ?? pickupFrom` | `null` |

A draft's `expires_at` is a placeholder for a NOT NULL column: every reader of
it filters on `status = 'open'` first (board, `findExpired`,
`assertListingOpen`, thread offers) and `publishListing` recomputes it. A draft
keeps no schedule: the column means "while status is `scheduled`" and nothing
publishes a draft at its scheduled time.

`publishListing` is unchanged (it re-checks both codes against `now`).

## 3. Client — `/create`

### 3.1 Moment of publication

`publishAt` = the scheduled instant when `publishMode === "schedule"` and a
valid date is set; otherwise **now**.

### 3.2 What is checked — `publicationIssues(values, now)`

`src/features/app/create/publication.ts`, pure:

| Field | Value | When |
|---|---|---|
| `pickup` | `"inPast"` | the whole window has ended: `pickupUntil <= now` |
| | `"tooSoon"` (+ `earliest`) | otherwise, publishing now leaves no time to bid — `expiresAtFor(pickupFrom, now)` is `null`, **or the window has started but not ended**. The server answers `PICKUP_IN_PAST` for the latter; to the requester a morning still under way at eleven is too close, not passed |
| `schedule` | `"required"` | `publishMode === "schedule"` and no date |
| | `"past"` | the date is `<= now` |
| | `"tooClose"` (+ `latest` = `pickupFrom − 30 min − 15 min`) | `pickup` is fine but `expiresAtFor(pickupFrom, schedule + 15 min)` is `null`. The 15 minutes (`SCHEDULE_SLACK_MS`) are the publishing cron's lateness: it runs every five minutes, GitHub starts it late, and `publishScheduled` re-checks the window against the moment it runs — a schedule right on the server's own limit is expired when the cron gets there |
| | `"unschedulable"` | as `"tooClose"`, but `latest` would fall at or before `now + 5 min` (`MIN_SCHEDULE_LEAD_MS`, the picker's own minimum) — a pickup under about fifty minutes away, where naming a moment already gone would be advice nobody could follow. Only « Maintenant » still works, and the message says so |
| `biddingClosesAt` | a Date | no `pickup`/`schedule` problem, and `expiresAtFor(pickupFrom, publishAt) − publishAt < 6 h` — the **warning** tier |

`earliest` is `firstUsablePickup(now)` (`request_availability_spec.md` §4):
now + 30 min + 5 min margin, rounded **up** to the half hour — the time the
message can promise will be accepted.

The check reads the pickup window from a derivation made **at render time**
(`resolveTimingWindows(timing, now)`), not from the form's fields: a flexible
start is clamped to the clock when it is derived, and read back fifteen minutes
later it would claim « trop proche » about a request « Publier » re-derives and
posts without complaint.

### 3.3 Where it is shown

| Issue | Step 3 « Quand » | Step 4 « Budget » |
|---|---|---|
| `pickup` (error) | under « Enlèvement », marked `data-publication-error` — not `data-field-error`, so a « Suivant » refused for another error scrolls to that error rather than to a notice that does not block it | a banner above the buttons, with « Modifier les dates » → step 3 |
| `schedule` (error) | — | under the schedule picker (`PublishTimingField`) |
| `biddingClosesAt` (warning) | under « Enlèvement », muted, not an error | under the publication choice |

Every issue is computed from the form's values on each render, so it appears
as soon as the dates are chosen — not only after a click.

### 3.4 What it blocks

| Action | Blocked by |
|---|---|
| « Suivant » on step 3 | the step's Zod fields (§3.6) only. The `pickup` error is on screen but does not hold the step: a draft is saved from step 4 with a budget, and holding « Suivant » would keep a too-soon request from ever being saved (found in Chromium) |
| « Publier la demande » / « Planifier la demande » | the whole schema, then `pickup` (→ step 3) and `schedule` (→ step 4) |
| « Enregistrer le brouillon » | the whole schema only — **never** `pickup` or `schedule`. If a `pickup` issue exists the success toast carries `create.toast.draftNote` as its description, so the warning the client asked for still reaches them. |

A blocked action moves to the step that holds the problem and scrolls to it.

### 3.5 Submitting

1. The four instants and the availability sets are re-derived from the When
   step's state with a fresh `now` (`resolveTimingWindows(timing, now)`), so a
   form left open for twenty minutes does not post a start that has since
   become too soon.
2. For a publication, §3.4's checks run on the re-derived values.
3. `form.handleSubmit(onValid, onInvalid)`. `onInvalid` moves to the first step
   that holds an error (`STEP_FIELDS` order), scrolls to it and toasts
   `toast.checkStep` naming that step — a button pressed on one step may land
   the requester on another, so they are told why; nothing is silent any more.
   The publication checks of §3.4 move and toast the same way. **Never
   forward past a step not yet reached with « Suivant »**: when the first error
   lies beyond it, `toast.finishSteps` shows and the form goes on to the
   **first step not yet reached** (`furthestStep + 1`) — every step up to the
   furthest is free of errors by then, so a requester who went back is not
   walked through steps already done. Jumping straight to « Budget » once
   skipped « Quand » unseen and published its defaults.
5. **A request is never posted twice.** A ref is set from the click until the
   request settles, and the buttons are disabled from the click
   (`formState.isSubmitting`, covering the async validation) to the
   navigation (`isPending || isSuccess`).
6. An address ticked « Enregistrer » on the Where step is saved when that step
   is left with « Suivant », when the form walks on past it, and on submit —
   **not awaited** on submit, since the request does not depend on it and a
   slow save must not hold « Publier » open. The tick is claimed before the
   address is sent, so two calls in flight never save it twice; a failed save
   restores it.
7. A draft is posted with `publish: false` and **no** `scheduledPublishAt`.

### 3.6 Zod (`schemas.ts`)

- `budgetEuros` is seeded `""` in `useJobForm`'s defaults. An unset number field
  coerced to `NaN` is a type error, which aborts the object before the root
  `superRefine`; `""` coerces to 0 and fails `.positive()` as an ordinary issue,
  so the When step's cross-date rules now run when « Suivant » is pressed there.
- The three schedule rules (`scheduledPublishRequired`, `scheduledPublishPast`,
  `scheduledPublishAfterPickup`) leave the schema: they are publication rules
  (§3.2) and must not block a draft.
- `noAllowedDay` is added (`request_availability_spec.md` §4).

### 3.7 Server codes the form still receives

| Code | Behaviour |
|---|---|
| `PICKUP_IN_PAST` | toast `toast.pickupInPast`, go to step 3 |
| `PICKUP_TOO_SOON` | toast `toast.pickupTooSoon`, go to step 3 |
| `SCHEDULED_PUBLISH_IN_PAST` | toast `toast.schedulePast`, go to step 4 |
| anything else | `toast.failed` for a publication, `toast.draftFailed` for a draft |

## 4. Copy

Step 3 says « Enlèvement », so every new sentence does too.

| Key | FR | EN |
|---|---|---|
| `create.publication.pickupInPast` | Ce créneau d'enlèvement est déjà passé. Choisissez des dates à venir. | This pickup window has already passed. Choose dates still to come. |
| `create.publication.pickupTooSoon` | L'enlèvement est trop proche de la publication : les transporteurs n'auraient pas le temps de faire une offre. Choisissez un enlèvement qui commence au plus tôt le {earliest}. | Pickup is too close to publication: carriers would have no time to make an offer. Choose a pickup starting {earliest} or later. |
| `create.publication.biddingShort` (a callout: neutral text on an amber tint, amber icon — amber text alone measured 3.75:1) | L'enlèvement est proche de la publication : les transporteurs pourront faire une offre jusqu'au {closesAt} seulement. Pour en recevoir davantage, prévoyez l'enlèvement plus tard. | Pickup is close to publication: carriers can only make an offer until {closesAt}. For more offers, plan the pickup later. |
| `create.publication.scheduleTooClose` | La publication est trop proche de l'enlèvement : planifiez-la au plus tard le {latest}, ou choisissez un enlèvement plus tard. | Publication is too close to pickup: schedule it for {latest} at the latest, or choose a later pickup. |
| `create.publication.editDates` | Modifier les dates | Change the dates |
| `create.toast.pickupTooSoon` | L'enlèvement est trop proche de la publication : les transporteurs n'auraient pas le temps de faire une offre. Modifiez-le à l'étape « Quand ». | Pickup is too close to publication: carriers would have no time to make an offer. Change it on the "When" step. |
| `create.toast.pickupInPast` | Ce créneau d'enlèvement est déjà passé. Modifiez-le à l'étape « Quand ». | This pickup window has already passed. Change it on the "When" step. |
| `create.toast.draftNote` | À noter : l'enlèvement est trop proche de la publication pour publier cette demande telle quelle. | Note: pickup is too close to publication to post this request as it is. |
| `create.toast.draftNotePast` | À noter : le créneau d'enlèvement de ce brouillon est déjà passé. | Note: this draft's pickup window has already passed. |
| `create.publication.scheduleImpossible` | L'enlèvement est trop proche pour planifier la publication : publiez maintenant, ou choisissez un enlèvement plus tard. | Pickup is too close to schedule the publication: publish now, or choose a later pickup. |
| `create.toast.finishSteps` | Complétez les étapes suivantes pour enregistrer votre demande. | Complete the next steps to save your request. |
| `create.toast.draftFailed` | Impossible d'enregistrer le brouillon. Veuillez réessayer. | Could not save your draft. Please try again. |
| `create.toast.checkStep` | Vérifiez l'étape « {step} ». | Check the "{step}" step. |

`create.validation.scheduledPublishPast` and `scheduledPublishRequired` stay
(shown for `schedule: "past"` / `"required"`); `scheduledPublishAfterPickup` is
replaced by `create.publication.scheduleTooClose`. `create.toast.posted` and
`create.toast.scheduled` are removed (the page in
`request_posted_page_spec.md` replaces them).

### 3.8 Found on the way: the form at phone width

At 375 px the row « Retour · Enregistrer le brouillon · Suivant/Publier » was
18 px wider than the form, and `<main>` clips — the primary button lost its
right edge on every step. It wraps now. The Where step's « Vous ne trouvez
pas ? Saisissez l'adresse… » link (`location-picker-field.tsx`) could not wrap
and overflowed by 93 px; it wraps too.

## 5. Edge cases

| # | Case | Behaviour |
|---|---|---|
| 1 | The client's values: Flexible 02/10→03/10 Matin, delivery 04/10, at 02/10 13:47 | The window starts 03/10 06:00 (today's morning has passed, `request_availability_spec.md` §4). No issue; the draft saves and publication is possible. |
| 2 | Exact 02/10 14:00 at 13:47 | Step 3 shows `pickupTooSoon` with « au plus tôt le 2 oct., 14:30 »; « Suivant » moves on and step 4 repeats it with « Modifier les dates »; « Publier » is refused; the draft saves, with `draftNote`. |
| 3 | Exact 02/10 15:00 at 13:47 | No error; warning « jusqu'au 2 oct., 14:17 ». |
| 4 | Schedule 08:50 for a 09:00 pickup | `schedule: "tooClose"`, « au plus tard le … 08:30 ». |
| 5 | Form left open past the limit, then « Publier » | Re-derived at submit; the issue appears and the step changes; nothing is posted. |
| 6 | Server and browser clocks disagree | The server still decides; §3.7's codes land on step 3 with their sentence. |
| 7 | Draft with a pickup already passed | Saved as `draft`, `expires_at = pickupFrom`. |

## 6. Test coverage required

- `src/lib/__tests__/listing-window.test.ts`: `publicationProblem` (past, too
  soon, fine, measured from a scheduled `publishAt`), `earliestPickupFor`.
- `src/features/app/create/__tests__/publication.test.ts`: every row of §3.2,
  including "tooClose" only when publishing now would be fine, and the warning
  appearing only under 6 h and never beside an error.
- `src/features/app/create/__tests__/schemas.test.ts`: with `budgetEuros: ""`,
  `deliveryBeforePickup` is raised (the abort is gone); a schedule in the past
  no longer fails the schema.
- `src/server/services/__tests__/listings.service.test.ts`: the pinned test
  flips — a draft with a past pickup is created as `draft` with
  `expiresAt = pickupFrom`; a draft with a past schedule is created with
  `scheduledPublishAt: null`; publishing keeps all three codes.
- `src/features/app/create/__tests__/jobs.api.test.ts`: a draft's payload has no
  `scheduledPublishAt`.
- Locale parity.
