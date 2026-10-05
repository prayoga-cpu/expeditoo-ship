# Spec — the page after a request is posted

**Plan:** `docs/plans/plan_create_form_feedback.md` · **Release:** 2.59.0

**Reported (2026-10-02, `#XBYUSQ2D`):** "LAST PAGE FORM: create a landing page
of thanks to register the ask for shipment on website", with a Cocolis screen
as the reference (« Félicitations ! … Voir mon annonce · Déposer une autre
annonce »).

This reverses `transport_request_spec.md` §3 "No success page", which was
written when the only success page available was the goods-auction leftover.

## 1. Routing — `useJobForm`

| The server answered | Then |
|---|---|
| a job with `publish: true` (live now **or** scheduled) | `router.replace("/create/success/{id}")` — `replace`, because the form's state dies with the page and Back would land on an empty form |
| a draft | unchanged: toast `draftSaved` (+ `draftNote`, `publication_timing_spec.md` §3.4), `router.push("/listings/me")` |

Either way `["my-jobs"]` is invalidated, so `/listings/me` and `/home` show the
new request at once instead of after the 60-second stale time. The form's
buttons stay disabled from the click to the navigation
(`formState.isSubmitting || isPending || isSuccess`, behind a ref that refuses
a second submit while one is in flight), so no gap can post it twice
(`publication_timing_spec.md` §3.5). The `posted` / `scheduled` toasts are gone: the page says it.

The destination is decided by `postCreateDestination(job, publish)` (pure).

> **Amended (2.60.0).** The same routing applies when the form finishes a
> saved request (`/create?draft=<id>`, `draft_requests_spec.md` §2–§3): the
> answer is then `PUT /api/listings/:id/draft`'s, for the same id. Before
> navigating, the form drops any cached `["job", id]` copy — the one the
> request's own page leaves behind, which still holds it as it was before the
> save. Read as a `draft`, §3 would go straight past the thank-you page to
> `/listing/{id}`; read as `scheduled`, a request just published would be
> thanked as still scheduled. A request published meanwhile (409
> `LISTING_NOT_DRAFT`) is `draft_requests_spec.md` §2's case, not this page's.

## 2. Route

- `src/app/(app)/(main)/create/success/[id]/page.tsx` — server component. No
  session → `redirect("/signin?callbackUrl=/create/success/{id}")`. Otherwise
  renders `RequestPostedScreen` with `listingId` and `viewerId`.
- `src/app/(app)/(main)/create/success/page.tsx` — no id → `redirect("/listings/me")`.

## 3. Screen — `RequestPostedScreen`

Data: `useJobDetail(id)` (`GET /api/listings/:id`), the hook `/listing/:id`
already uses; the owner can read their own scheduled row.

| State | Renders |
|---|---|
| loading | `PageLoader` |
| error (404, 403, network) | `CenteredEmptyState`: `notFound.title` / `notFound.description`, button « Mes demandes » |
| `job.shipperId !== viewerId` | `router.replace("/listing/{id}")` — someone else's request has its own page |
| status other than `open` / `scheduled` (e.g. revisited after award) | `router.replace("/listing/{id}")` |
| `open` / `scheduled` | the card below |

The card, centred in the shell (no `min-h-screen`: `<main>` scrolls):

1. `CheckCircle2` in `text-primary`, `h1` = `{status}.title`, lead =
   `{status}.lead`. Focus moves to the `h1` once the request is shown: the
   pressed button is gone and every app page shares one document title, so
   nothing else would tell a screen reader the request went out.
2. `ListingReference copyable` — the number support and carriers will quote.
3. `RequestSummary` — route, both windows, availability
   (`request_availability_spec.md` §6), protection, load — and the budget. Its
   title is an `h2` here (`titleAs`), so the headings run h1 → h2.
4. « Et maintenant ? » — an ordered list: `next.offers` (with `expiresAt`),
   `next.notify`, `next.choose`, `next.pay`.
5. Buttons: « Voir ma demande » (`/listing/{id}`, primary), « Mes demandes »
   (`/listings/me`), « Déposer une autre demande » (`/create`).

### What it says, and on what authority

> **Amended (2.60.0) by `take_job_spec.md`.** In 2.59.0 a carrier could take
> any open job at its budget, so two rows here read "you choose — unless a
> carrier takes it at your budget" and "nothing charged before the award", and
> `next.choose` / `next.pay` (§4) said the same. Taking is now for escalated
> jobs only, and this page renders only for `/create` jobs, which are always
> `direct` — so both sentences are back to the plain promise.

| Sentence | True because |
|---|---|
| offers until `{expiresAt}` | `listings.expires_at`, set from the publication moment by `createListing`, or by `saveDraft` for a finished draft (`publication_timing_spec.md` §2) |
| notified in the app for each offer | `offersService.submitOffer` creates a bell notification for the owner |
| you choose your carrier | on a `direct` job `acceptOffer` admits the owner and nobody else, and `takeJob` refuses it (`TAKE_NOT_AVAILABLE`, `take_job_spec.md` §2–§3) |
| you pay only when you accept an offer | the card is taken when the requester accepts, in the accept dialog (`pay_at_accept_spec.md` §3); with no take on a direct job, nothing else charges it |
| scheduled for `{scheduledPublishAt}` | the row's own column (added to `Job`) |

It does **not** say an email was sent. `announceListingPosted` sends one only on
publish-now, skips it when the requester turned the preference off, swallows
failures, and production's Resend sandbox delivers only to the account owner
(STATUS → Operator to-do). Once a sending domain is verified this can be
revisited. It does not claim carriers were alerted either: the response carries
no count.

## 4. Copy — `create.success.*`

| Key | FR | EN |
|---|---|---|
| `open.title` | Merci ! Votre demande est publiée. | Thank you! Your request is live. |
| `open.lead` | Les transporteurs peuvent dès maintenant vous faire des offres. | Carriers can start making you offers now. |
| `scheduled.title` | Merci ! Votre demande est planifiée. | Thank you! Your request is scheduled. |
| `scheduled.lead` | Elle sera publiée le {date}. Les transporteurs pourront alors vous faire des offres. | It goes live on {date}. Carriers can make you offers from then. |
| `budget` | Budget indiqué : {amount} | Your budget: {amount} |
| `next.title` | Et maintenant ? | What happens next? |
| `next.offers` | Les transporteurs vous envoient leurs offres jusqu'au {date}. | Carriers send you their offers until {date}. |
| `next.notify` | Vous êtes prévenu dans l'application à chaque nouvelle offre. | You are notified in the app for every new offer. |
| `next.choose` | Vous comparez les offres et choisissez votre transporteur. | You compare the offers and choose your carrier. |
| `next.pay` | Vous ne payez qu'au moment où vous acceptez une offre. | You only pay when you accept an offer. |
| `actions.view` | Voir ma demande | View my request |
| `actions.myRequests` | Mes demandes | My requests |
| `actions.another` | Déposer une autre demande | Post another request |
| `notFound.title` | Demande introuvable | Request not found |
| `notFound.description` | Elle a peut-être été supprimée, ou ce lien n'est pas le bon. | It may have been deleted, or this link is wrong. |

Dates through `useFormatter` (day, short month, hour, minute).

## 5. Test coverage required

- `src/features/app/create/__tests__/RequestPostedScreen.test.tsx`: an `open`
  job shows the title, reference, the four next steps and the three links; a
  `scheduled` job shows its publication date; an error shows `notFound` with a
  link to `/listings/me`; another user's job and an `awarded` job call
  `router.replace("/listing/{id}")`.
- `src/features/app/create/__tests__/destination.test.ts`:
  `postCreateDestination` — publish → `/create/success/{id}`, draft →
  `/listings/me`.
- `src/features/app/create/__tests__/useJobForm.test.tsx`: a resumed draft
  published with PUT lands on `/create/success/{id}` for the same id
  (`draft_requests_spec.md` §7).
- Locale parity.
