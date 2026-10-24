# Client feedback of 21 October 2026 — spec

Status: **current** (2.65.0). Plan: `docs/plans/plan_client_feedback_2026_10_21.md`.
Monitor: the top of `STATUS.md`, one row per item below.

Nicolas walked through the admin and the client space in a 49-minute review on
21 October 2026; Evan wrote it up as 19 points (A1–D6) and 4 actions
(`Expeditoo_retours_Nicolas_21-10-2026.pdf`). Each section below quotes the
point, says what the app did, and fixes the behaviour. Where the point left a
choice open, the choice made is in §0 so it can be overruled cheaply. §X1 is a
fault found while checking the points, not one of them, and it explains part of
what Nicolas saw.

---

## 0. Readings chosen without the client

| | Point | Reading built | Why |
|---|---|---|---|
| A | A2 « classée par date de la demande » | « À traiter » oldest request first; « Récents » newest first; both show the arrow and the date | A worklist is first come, first served; a feed of arrivals is newest first |
| B | A3 « un numéro, complété par la référence Airtable » | Every quote gets **DEV-NNNNN** from a sequence, the Airtable « Numéro Devis » under it | One series for both inlets; the prefix keeps it apart from Airtable's bare digits and a job's six-digit Réf. |
| C | A4 « initiales + ville de départ + ville d'arrivée » | **PAR-CLA-100018**: three letters per city in front of the existing number; **no initials** | The reference is printed on the drivers' board; a requester's initials there would say who posted it. Initials can be added to staff screens only if wanted |
| D | B1 « la file d'attribution devrait lister les demandes en attente de chauffeur » | A second, **read-only** section for every other open request; awarding a direct request stays with its requester | The requester pays in the accept dialog with their own card and answers 3-D Secure; an operator cannot do that for them |
| E | B5 « encart d'urgence » | **Derived**: urgent = open, and the pickup must happen within 48 h (start of the window when fixed, end when flexible) | No field for anyone to forget to untick; a flag would go on saying « urgent » after the date passed |
| F | B6 « l'autre prix proposé » | The requester's budget and the gap in % under every offer in a thread | « Contre-proposition » could also mean a requester counter-offer, a bigger feature — asked, not built |
| G | D2 « liste, carte ou gros plan » | Liste / Cartes / Détaillé on « Mes demandes »; « carte » read as *card* | The point asks for several displays of the same requests; a map is a different feature — asked |
| H | D6 « prises » | Taken = a transporter holds the award or did the run (`awarded`, `in_progress`, `completed`) | — |

---

## A1. « À traiter » vs « Tous » (Supervision)

**Was.** The sidebar badge on « Passerelle Expedion » counted every quote to
price, every paid quote with no driver and every one past its auto-publish
deadline — **summed**, so a paid quote past its deadline counted twice. The
« À traiter » tab filtered the **25 most recent** quotes only. Production read
48 on the badge and 1 on the tab.

**Now.**
- `ACTIONABLE` (`expedion-report.dal.ts`) is the OR of the three queue
  predicates. The badge (`admin-nav.dal.ts`) and the « À traiter » KPI
  (`ExpedionTotals.actionable`) both count it, each quote once.
- « À traiter » lists every row of the report's four queues (to price, needs a
  driver, storage at risk, escalation due), deduplicated, filtered by
  `nextAction(row).actionable`, oldest request first (`worklist()`).
- « Tous » is renamed **« Récents »** and keeps the 25 latest, newest first.
- Under the tabs, one line says what the active tab holds and in which order
  (`admin.expedion.recent.todoHint` / `allHint`).
- Each queue is still capped at 50 rows by the report.

## A2. Sort by request date

- The date column is renamed **« Reçu »** and shows the day under the
  relative age (« il y a 27 jours · 24 sept. 2026 »).
- `DataTable` takes `initialSorting`; the panel opens sorted on « Reçu »,
  ascending on « À traiter », descending on « Récents », so the header arrow
  shows the order. Switching tab resets it.

## A3. Every quote has our number

- Migration `0040_expedion_quote_reference`: sequence
  `expedion_quote_reference_seq` (integer, from 1), column
  `expedion_quotes.reference integer NOT NULL DEFAULT nextval(...)`, unique.
  Existing rows numbered by `requested_at`, then `created_at`, then `id`.
  Re-runnable: the backfill touches only rows without a number, and `setval`
  follows the highest issued.
- Displayed `DEV-` + five digits (`formatQuoteReference`); `parseQuoteReference`
  reads « DEV-04659 », « dev 4659 ».
- Supervision tables, the quote dialog title and the client-book dialog show it
  first; the Airtable « Numéro Devis » (`quote_number`) or, failing that, the
  client's bordereau number sits under it, labelled. The quote id stays in the
  tooltip. Search matches all of them.
- `quote_number` is unchanged and still written only by the Airtable import.

## A4. One reference format for jobs

- `formatListingReference(reference, from, to)` → « PAR-CLA-100018 »:
  `cityCode` takes the first three letters of each city, accents and spaces
  dropped (« Évry » → EVR, « Le Havre » → LEH). Without both cities, the number
  alone.
- `ListingReference` takes `from` / `to` and every surface that has the cities
  passes them: job page, « Mes demandes », delivered requests, the posted
  screen, the admin listings, the award queue, the shipments table, the
  carrier's pending offers and active trips.
- **The number is the identity.** Copying copies the number;
  `parseListingReference` drops the letters, so « PAR-CLA-100018 », « Réf.
  PAR-CLA-100018 » and « 100018 » all find the job. A corrected address changes
  the letters, never the number. (This amends listing_reference_spec.md §1,
  which said « digits only »: the digits still are.)

## A5. The driver on the shipments table

- `GET /api/admin/shipments` goes through `shipmentService.adminOverview`
  (admin or operator; `FORBIDDEN` otherwise). The route used to check the role
  itself and read the table straight from the database.
- `shipmentsDal.adminOverview` selects named columns and the job's id, title,
  reference and cities, the transporter's and the driver's names — nothing
  else of either party.
- `driverName` is the assigned driver, else the transporter who won (the same
  person for an individual driver), else null.
- Columns: Réf. (A4 format; `#` + 8 characters only for a run with no job),
  Titre, Itinéraire, **Chauffeur** (« Pas encore de chauffeur » when null),
  Statut (the client's vocabulary, `deliveries.shipmentStatus`), Prix, Créé.
  « Propositions » (hard-coded 0) and « Assigner » (a dead button) are removed.

## A6. Switch roles from one account — already built

The access switcher (2.61.0). Nothing changes.

## B1. The award queue lists every request without a driver

- **À attribuer (n)** — escalated jobs with at least one bid: the operator's
  decision, as before.
- **En attente d'un chauffeur (n)** — every other open job: escalated jobs with
  no bid yet, and every direct request, soonest pickup first. Each card says
  who decides (« Vous choisissez » / « Le demandeur choisit »), its bids, its
  pickup, and on a direct request the requester's name and budget.
- Two `browse` reads (one per origin, 50 each) so direct requests cannot push
  an escalated job off the first list.
- The sidebar badge counts « À attribuer » only, and now with the board's own
  `expires_at >= now()`: a job past its deadline cannot be awarded from the
  page, and counting it showed « 1 » over « Rien en attente ».

## B2. A transporter's cancellation re-opens the job — already built

« Me désister » (cancellations_spec.md). Nothing changes.

## B3. « Directe »

Not a checkbox: the origin tag. It now explains itself on hover —
« Demande publiée sur Expeditoo par son demandeur. C'est lui qui choisit le
transporteur et paie avec sa carte. » / « via Expedion »: « Devis Expedion payé
et publié faute de chauffeur. Un opérateur choisit le transporteur à la place
du client. » The label stays until Léa's question arrives.

## B4. Title, requester and price pinned on the job page

`JobIdentityBar`: title, reference (A4), requester (direct requests only — an
escalated job's owner is the system account) and budget, `sticky top-0` as a
direct child of the page container, so it stays on both tabs. Opaque
background: a translucent one let the page show through. The status and
property badges stay below it.

## B5. Urgent

`isUrgent(job, now)` (`src/lib/urgency.ts`, decision E). `UrgentBadge` renders
« Urgent » in the destructive colour, with the rule as its tooltip, on: the
board card, the job page, « Mes demandes » (all three views), the dashboard,
the admin listings, the award queue. The board's existing 6-hour badge, about
the *bidding* closing, is relabelled « Clôture bientôt » so the two never share
a word.

## B6. The other price in the thread

`ThreadOfferBubble` takes `budgetCents` (the thread's `offerContext.job`) and
prints « Budget du demandeur : 100,00 € · 15 % en dessous » (`priceGap`), green
below, amber above. Nothing on a thread with no job.

## C1, C2. Driver payouts — not built

Unchanged: payouts are recorded and paid by hand. Stripe Connect Express
onboarding and `paymentsService.executePayout` exist and are deliberately not
wired; they wait on the commission split (ROADMAP §10) and the client's lawyer.

## C3. PayPal and Apple Pay — not built

Card only on purpose (`CARD_FORM_ONLY` in the accept dialog,
`payment_method_types: ["card"]`). Owned by Léa. Apple Pay needs the domain
registered with Stripe before the wallet can be shown; PayPal needs enabling on
the Stripe account and a check that it fits a hold-then-capture award and a
saved method. Payment code is live-money code and is not changed here.

## C4. « Mot de passe oublié » does not work

**Cause.** The code path works: `/forgot-password` → Better Auth
`/request-password-reset` → `sendPasswordResetEmail`. Production sends through
Resend's sandbox sender, which delivers only to the Resend account owner's
address and refuses every other one (STATUS Operator to-do since 2026-09-23).
The refusal was invisible: the SDK *returns* `{ error }`, nobody read it, and
the page said the email was sent.

**Now.**
- `assertSent(result, what)` (`src/lib/email.ts`) throws on a returned error;
  the reset and verification senders call it inside their existing
  try/catch, so a refusal is logged with what to do about it. Not thrown
  further: the response must not reveal whether an account exists.
- The reset email is French: subject « Réinitialisez votre mot de passe
  EXPEDITOO / Expedion », body and button. The `/reset-password` page is
  translated (`auth.resetPassword.*`); it was entirely English.
- **The fix is the owner's**: verify a sending domain in Resend and set
  `EMAIL_FROM` in Vercel.

## D1. A condensed dashboard

`RequestsDigest`: « Vos N demandes en cours » with up to four compact rows
(status and urgency stacked, title, route · day, price, bids) and « Tout
voir ». `activeRequests()` keeps open, awarded and in-progress requests, newest
published first, and drops an open request past its deadline. It replaces the
single full-size card that showed only the newest request.

## D2. List / cards / detailed

`RequestViewSwitcher` on « Mes demandes »: Liste (`RequestCompactRow`), Cartes
(`RequestTile`, a grid), Détaillé (unchanged). The choice is kept in
`localStorage` (`expeditoo.myRequests.view`), every access wrapped, default
« Détaillé ».

## D3. Readable on a phone

On the job page below `sm`, pickup and delivery are cards side by side that
scroll sideways with snap, each 85 % of the width, with « Faites glisser pour
voir la livraison → » above them; from `sm` up, two columns as before. With the
pinned bar (B4) the job's identity stays on screen. The vertical icon strip in
Nicolas's screenshots is a browser extension, not the app.

## D4. A confirmation after every action

Audited every mutation hook. Already confirmed: publish (thank-you page),
draft, award, take, cancel, withdraw, routes, documents, contact details,
company details. Fixed: « Offer submitted » / « Offer withdrawn » and the 15
offer refusal messages were hard-coded English → `listing.bid.toast.*` and
`listing.bid.submitErrors.*`; deleting a conversation now says so, and says so
when it fails.

## D5. Message search by listing

- `matchesConversationSearch` (`src/lib/conversation-search.ts`): the other
  person, the title, either city, a route typed with an arrow or a dash (both
  ends, in order), the reference (A4 letters or not); accents and case
  ignored. A route that does not match falls through to the plain search, so a
  title holding a dash is still found.
- Under the search box, « Vos annonces en cours »: one chip per job with a
  thread, then the viewer's own live requests (`listingChips`). A chip filters
  the inbox; tapped again it clears. A job with no thread yet shows « Pas encore
  de conversation sur Paris → Clamart » and, on the viewer's own request, « Voir
  les transporteurs sur ce trajet » (`/listing/<id>?tab=carriers`).

## D6. Requests posted and taken

`GET /api/users/:id/activity` → `{ posted, taken }` through
`listingsService.activityFor` (the person themselves, admin or operator;
`FORBIDDEN` otherwise). Posted = every request not `draft` or `scheduled`;
taken = decision H. `RequestActivityCard` on `/profile` and on the admin's
« Voir le profil »; a failed read shows « — ».

## X1. The scheduled jobs had never run in production

**Found.** `.github/workflows/scheduled-jobs.yml` failed every run on record
(1,000 checked on 2026-10-24): the repository has no `APP_URL` variable and no
`CRON_SECRET` secret. So in production no listing has ever expired (7 `open`
past `expires_at`, the oldest from 24 September), the paid quote `a-111-02`
was never auto-published, scheduled requests would never publish, and driver
documents are never checked.

**Now.**
- Migration `0041_cron_heartbeat`: `cron_heartbeat(job pk, last_run_at,
  last_ok, last_error, last_ok_at)`. Each `/api/cron/*` route stamps it after
  an **authorised** run, success or failure (`cronHealthService.record`, which
  never throws). An unauthorised call writes nothing.
- Admin → Paramètres → « Tâches planifiées» (`GET /api/admin/cron-status`,
  admin or finance): each job, its schedule, its last run and a state —
  « À l'heure », « En retard » (no run for 3 slots, never less than an hour),
  « En échec » with the message, « Jamais ». Any « Jamais » shows what to set
  in GitHub.
- `displayStatus(job)`: an `open` request past `expires_at` **reads**
  « Expirée » on « Mes demandes », the job page and the admin listings, as the
  board already treats it. Display only — the sweep stays the only writer.
- **The fix is the owner's**: set the variable and the secret.

---

## Test coverage required

- `urgency.test.ts`: fixed vs flexible, 48 h edge, past, every non-open status.
- `listing-reference.test.ts`: `cityCode`, `formatListingReference`, parsing
  with letters.
- `quote-reference.test.ts`, `conversation-search.test.ts`, `displayStatus.test.ts`.
- `RecentQuotesWorklist.test.tsx` (order, dedupe, idle rows dropped);
  `AwardQueueSplit.test.tsx`; `priceGap.test.tsx`; `listingChips.test.ts`;
  `myRequestStatus.test.ts` (`activeRequests`).
- Services: `shipment.admin-overview.test.ts`, `listings.activity.test.ts`,
  `cron-health.service.test.ts` (states, permission, never throws),
  `auth.service.test.ts` (a returned refusal is logged; French subject).
- UI: `JobDetail.test.tsx` (sticky bar, requester, urgent, expired, swipe
  container), `DraftActions.test.tsx` (the three views and their memory),
  `ThreadOfferBubble.test.tsx` (budget line), `DeliveriesTable.test.tsx`,
  `MessagesChips.test.tsx`.
- Migrations: `migrations-journal.test.ts`, plus 0040 run against a database
  holding quotes (oldest numbered first, a new quote takes the next, a re-run
  renumbers nothing).
