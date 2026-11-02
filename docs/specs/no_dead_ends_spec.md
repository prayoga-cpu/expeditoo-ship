# Spec — no dead ends

**Plan:** `docs/plans/plan_no_dead_ends.md` · **Release:** 2.75.0

**The rule.** No screen ends on a sentence with nothing to press. A refusal
names what to do instead; a failed read offers to read again; an empty list
says where the next thing comes from; and every request its owner can see
can still be changed, called off or posted again, whatever state it is in.
« Fermer » is always there — it is never alone.

## 1. The accept dialog

A refusal while quoting, authorising or accepting replaces the card form with
the refusal and its next steps. The form is no use once the offer, the slot or
the request is what failed: paying again would fail again.

| Code | Next steps (first is primary) |
|---|---|
| `COORDINATES_REQUIRED` | Modifier la demande |
| `SLOT_IN_PAST`, `SLOT_NOT_ON_OFFER` | Choisir un autre créneau |
| `OFFER_NOT_PENDING`, `OFFER_NOT_FOUND`, `CARRIER_NO_LONGER_APPROVED`, `CARRIER_ABSENT` | Voir les autres offres · Transporteurs sur ce trajet |
| `LISTING_NOT_OPEN`, `LISTING_NOT_FOUND` | Voir où en est la demande |
| `PAYMENT_INTENT_MISMATCH`, `PAYMENT_NOT_REQUIRED` | Réessayer (re-quotes) |
| `FORBIDDEN_NOT_SHIPPER`, `FORBIDDEN_NOT_OPERATOR` | none — not this viewer's to award |
| any other / no code (network, 5xx) on the **quote** | Réessayer |

- « Choisir un autre créneau », « Voir les autres offres » and « Voir où en
  est la demande » close the dialog and re-read every query, so the page
  behind shows the truth.
- « Modifier la demande » and « Transporteurs sur ce trajet » exist only when
  the caller supplies them (`nextSteps.editRequest`, `nextSteps.carriers`).
  The job page supplies the first to the request's owner on an open direct
  request — it opens the same confirmation as « Modifier » (§2) — and the
  second to anyone who sees the tab strip. The operator's queue and the chat
  bubble supply neither.
- After a Pay press on a charged quote, the refusal adds « Votre carte n'a pas
  été débitée. » — true because the server releases the authorisation when it
  refuses. A prepaid or test-mode quote never mentions a card.
- **Unchanged:** a refusal not in the table keeps the step and its Pay button
  (« L'offre n'a pas été acceptée et votre carte n'a pas été débitée. »); an
  unknown outcome (no typed 4xx) still offers only « Fermer » and re-reads
  everything, because the capture may have happened.
- A background refetch of a quote already on screen never shows the loader:
  it would unmount a half-typed card, and the 3-D Secure frame stealing focus
  is exactly such a refetch.

## 2. A live request: change it, or call it off

`RequestActions` renders for the owner of a **direct** request on its page
(below the header) and on its « Mes demandes » card (outside the link).

| Status | Actions |
|---|---|
| `draft`, `scheduled` | unchanged — `DraftActions` |
| `open` | « Modifier » · « Annuler la demande » (each after a confirmation) |
| `awarded`, `in_progress` | « Suivre la livraison » → `/deliveries` (cancel lives on the delivery) |
| `expired`, `cancelled`, `completed` | « Republier » (§3) |

An escalated job shows nothing: it belongs to the Expedion system account.

### 2.1 « Modifier » — `POST /api/listings/:id/unpublish`

The request goes back to `draft` and the form opens on it
(`/create?draft=:id`). Publishing goes through the Budget step and nowhere
else (gotcha 19), so an edit gets the publication checks, the re-armed
`expires_at` and the pin lookup a new request gets — no second, laxer edit
path. The confirmation says it leaves the board until republished, and, when
`offersCount > 0`, that the offers received will be withdrawn and their
carriers told.

- Owner only (`FORBIDDEN_NOT_OWNER` 403); direct only (`LISTING_NOT_EDITABLE`
  409).
- **Compare-and-set on `open`** (`updateIfStatus`): an award landing at the
  same moment wins, and this answers `LISTING_NOT_OPEN` 409 having withdrawn
  nothing.
- Writes `status = draft`, `offers_count = 0`, `expires_at` = the draft
  placeholder, `reopened_at = null` (« Réouverte » says a machine moved the
  dates; the owner has now set them).
- Every pending offer is expired; each carrier gets « Demande en cours de
  modification », linking to `/carrier/offers` (a draft cannot be opened by
  them). Answers `{ listing, withdrawnOffers }`.

### 2.2 « Annuler la demande » — `DELETE /api/listings/:id`

The existing route, now reachable by the requester. `cancelListing` becomes a
**compare-and-set** on the status it read: an award in between wins
(`LISTING_NOT_CANCELLABLE` 409) instead of a paid job being cancelled behind
its back. Pending offers are expired after the write, and each carrier gets
« Demande annulée », linking to the board. The answer is projected through
`toListingView(…, "full")`, never the DAL row (gotcha 16).

### 2.3 Refusals

`LISTING_NOT_OPEN`, `LISTING_NOT_CANCELLABLE`, `CANCEL_VIA_SHIPMENT`,
`LISTING_NOT_ENDED` each have their own copy, re-read the request and the
list, and the first and third carry « Suivre la livraison » as the toast's
action. Anything else: « L'action n'a pas abouti. Réessayez. »

## 3. An ended request: « Republier » — `POST /api/listings/:id/repost`

`expired`, `cancelled` or `completed`, direct, owner only; anything else is
`LISTING_NOT_ENDED` 409. The request is **copied** into a new draft and the
form opens on the copy; the original is untouched — its offers, run and money
are its own. `listingsDal.copyAsDraft` copies the row as stored, so a column
added later carries over unasked, and resets only what the server owns: a new
id and reference (the sequence), `status = draft`, `accepted_offer_id`,
`origin = direct`, `external_ref`, the counters, `expires_at`, `reopened_at`,
`scheduled_published_at`, `published_at`. Photos are copied as new rows on the
same URLs (the image sweep keeps an object any row names). Answers `{ id }`.

## 4. Failed reads

`LoadErrorState` (`components/ui/load-error-state.tsx`): « Le chargement n'a
pas abouti » + « Réessayer », an optional way back, and an `inline` variant
for a card inside a page that loaded. « Introuvable » is said only for a 404
or 403; anything else is a failed read.

Now on it: « Mes demandes » list and history; deliveries list and page;
delivery photos; incidents (section and queue); the inbox and every thread
(requester, driver, admin support — the header read « Chargement… » forever
over an input box); notifications; `/home` (a failed count read « 0 »);
the driver dashboard, run list and run page; the driver application (a
failure showed the blank form to a driver already under review) and fleet
(« apply first »); « Mes offres »; reviews; settings' notification
preferences; staff contact card; the job board (« Réessayer » beside
« Effacer les filtres »); and the admin award queue, payments, applications,
payout queue, Expedion clients and client dialog, direct requests and
feedback.

## 5. Empty states

A way on wherever one exists, worded once in `common.nextSteps`: no
deliveries → « Demander un transport » · « Mes demandes »; empty history →
« Mes demandes »; filtered to nothing → « Tout afficher »; no messages →
« Mes demandes » (or « Voir les missions disponibles » in the driver shell);
no runs, trips or statement lines → the board; not a carrier yet → « Devenir
chauffeur »; no offers on a request → « Voir les transporteurs sur ce
trajet » (the carriers tab).

## 6. Carrier and driver

- A carrier with a **pending offer** on the job sees « Vous avez proposé
  {price} » with « Mes offres » and « Retirer mon offre », not the form the
  server would refuse with `OFFER_ALREADY_EXISTS`.
- A refused bid or take carries its action: `CARRIER_ABSENT` → « Gérer ma
  disponibilité »; `CARRIER_NOT_APPROVED` → « Mon dossier »;
  `LISTING_NOT_OPEN`/`LISTING_EXPIRED` → « Autres missions »;
  `OFFER_ALREADY_EXISTS` → « Mes offres »; `VEHICLE_CAPACITY_*` → « Ajouter
  un véhicule ». A slot or price refusal has none: the form is on screen.
- When no active vehicle fits the load, the offer form says so under the
  vehicle box, with « Gérer ma flotte ».
- A driver's `WITHDRAW_AFTER_PICKUP` / `CANCEL_REQUIRES_SUPPORT` carries
  « Contacter le support » (`/driver/help`); `INVALID_STATUS_TRANSITION`
  carries « Actualiser ».
- « Mes offres » (`/carrier/offers`) is translated; a bid that is over links
  to the board, not to a job that may be gone or back in draft.

## 7. Prevention

`src/__tests__/no-dead-ends.test.ts` reads every `.tsx` under `features/` and
`app/` and fails on (a) a file that renders an `isError` branch with no retry
(`LoadErrorState`, `onRetry`, `refetch` or `retry`) and (b) a self-closing
`<CenteredEmptyState />`, unless an allowlist entry states why — an empty
staff queue is the goal, a panel that carries its own refresh, and so on. A
third check fails on an allowlist entry that no longer matches anything.

## Known limits

- An edit withdraws every pending offer, even for a typo. That is the price
  of one publish path; the confirmation says so before anything happens.
- A carrier who submits in the instant between « Modifier » and the offers'
  expiry leaves a pending offer on the draft. `updateListing` has the same
  window; the bid is still visible to the requester and can be refused.
- The board and job page of an escalated job keep offering nothing to its
  client here: they act in the Expedion app.

## Test coverage required

- Service: unpublish (CAS on open, offers expired, notice, stranger,
  escalated), repost (three ended statuses, four refused, stranger),
  cancelListing (CAS, race lost, notice, projection).
- Dialog: each next-step kind, the « not debited » line only for a charged
  quote, retry re-reads the quote, nothing offered without a caller's step.
- `RequestActions`: each status's actions, both confirmations, the offers
  warning, the race refusal's toast action.
- The guard (§7).
- Once on a real Postgres: unpublish, cancel, repost (references from the
  sequence, photos copied).
