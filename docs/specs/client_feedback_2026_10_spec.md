# Client feedback of 7–8 October 2026 — spec

Status: **current** (2.63.0). Plan: `docs/plans/plan_client_feedback_2026_10.md`.
Monitor: the top of `STATUS.md`, one row per item below.

The client sent eleven requests over WhatsApp on 7–8 October 2026, most with a
photo of the screen they meant. Each section quotes the request, says what the
app did, and fixes the behaviour. Where the request left a choice open, the
choice made is stated as such (§0) so it can be overruled cheaply.

---

## 0. Readings chosen without the client

| | Request | Reading built | Why |
|---|---|---|---|
| A | #3 « put flexible in first position » | Flexible is first **and** selected by default | A first option that is not the selected one reads as a mistake |
| B | #9 « the 2 fields « details » » | The pickup and the delivery note (« Note pour le transporteur ») | Only one field is titled « Détails »; the two that come as a pair are these, and access conditions are a property of a place |
| C | #1 « carrier register form » | The sign-up form (`/signup`, namespace `auth.register`) | It holds the single « Nom complet » field the message asks to split; #2, a minute later, is on the same page; the driver application has no name field |
| D | #7b « second phone of another relative person » | Seen by the account holder and staff only | A relative's number is a third party's personal data; no carrier or requester needs it to do a job |
| E | #4 « change the beginning date by the end date » | Applies to requests published from 2.63.0 on | A live request's deadline is a promise already made to bidders |

---

## 1. Sign-up asks for first name, last name and an optional alias (#1)

> *About the carrier register form: please create another field to have two
> fields for name and first name (and perhaps also an alias)*

**Before.** `/signup` had one field, « Nom complet », written to `user.name`.

**After.**
- Three fields replace it, in this order: **Prénom** (required), **Nom**
  (required), **Pseudo** (optional, with the hint that it is not shown to
  others yet).
- Each is trimmed; Prénom and Nom 1–80 characters, Pseudo 0–40. Errors:
  `auth.register.errors.firstNameRequired`, `lastNameRequired`, `aliasTooLong`.
- `user.name` becomes `"<Prénom> <Nom>"`, so every surface that reads `name`
  (admin tables, emails, the sidebar, offers) keeps working unchanged.
- `user.first_name`, `user.last_name`, `user.alias` (nullable `text`, migration
  `0038`) hold the parts. They reach Better Auth as `additionalFields` with a
  validator, so the server enforces the same lengths as the form.
- Google sign-up fills `first_name` / `last_name` from the profile's
  `given_name` / `family_name` when Google sends them.
- **The alias is collected and editable (§7b) but shown to nobody else.**
  Where a pseudonym should stand in for the real name is the client's call.

## 2. No placeholder in password fields (#2)

> *Delete the stars to invite in secret key field*

The five password inputs (`/signup` ×2, `/signin`, `/reset-password` ×2) lose
`placeholder="••••••••"`. Nothing replaces it.

## 3. « Flexible » first, and the default (#3)

> *Can we change the rank and put flexible in first position?*

`TIMING_MODES` is `["flexible", "exact"]` and `defaultTimingState().mode` is
`"flexible"`. A resumed draft keeps the mode it was saved with
(`from-listing.ts`). Default dates are unchanged: pickup tomorrow, delivery the
day after — as one-day flexible ranges.

## 4. A flexible request takes offers until its window ends (#4)

> *When the ad is published, please change the beginning date by the end date
> (here 31 October)*

**Before.** The thank-you page said « offres jusqu'au 8 oct. à 00:00 » for a
request collecting 8–31 October, and that was true: bidding closed 6 h before
the **start** of the pickup window (`expiresAtFor(pickupFrom)`), and the
15-minute expiry cron then closed the job. Changing the sentence alone would
have made it false.

**After.**
- `biddingDeadline(pickupFrom, runsUntil, now)` in `src/lib/listing-window.ts`:
  whether the job can go live is decided on `pickupFrom` **exactly as before**
  (`null` → `PICKUP_TOO_SOON`); when it can and `runsUntil` is given and later
  than `pickupFrom`, bidding closes `BIDDING_LEAD_MS` before `runsUntil`.
- `runsUntil` is `pickupUntil` for a **flexible direct** request, `null`
  otherwise. Direct means not owned by the Expedion system account
  (`isSystemAccount`) when the request is created, and `origin = 'direct'` on
  an existing row.
- Every path that sets `expires_at` on a live request uses it:
  `createListing`, `saveDraft` (publish), `settleScheduled` (the scheduler),
  and the two re-board paths in `offers.service.ts` (`rearmedExpiry`,
  `rearmedWindow` take the same `runsUntil`).
- **Escalated jobs keep the start-based deadline.** Their take/assign lanes
  book `estimated_pickup = pickupFrom` (`resolveSchedule`, slot-less), which
  would be a date already passed if bidding ran past it.
- A re-boarded flexible direct job whose window has started but not ended
  keeps its dates and takes offers until 6 h before the window's end; it slides
  only when that is no longer usable (the existing `MIN_BIDDING_WINDOW_MS`).
- The form's "bidding closes in under six hours" warning
  (`publicationIssues().biddingClosesAt`) reads the same function, so it no
  longer fires for a flexible request whose window runs for weeks.
- The thank-you page (`RequestPostedScreen`) keeps printing `job.expiresAt`; it
  now reads « jusqu'au 31 oct. à 16:00 » for the client's example.
- Exact-date requests: unchanged in every respect.

## 5. « Mes trajets » gains three sub-tabs (#5)

> *About personal space carrier — my journeys section — need to create sub
> choices below: in waiting of answer, in transit, finished*

`/carrier/trips` tabs, in order, URL-held in `?tab=`:

| Tab | `?tab=` | Shows | Source |
|---|---|---|---|
| Prévus | `planned` (default) | Declared trajets — unchanged | `GET /api/carrier/routes` |
| En attente de réponse | `pending` | The carrier's offers still awaiting the requester or operator | `GET /api/carrier/offers?status=pending` |
| En transit | `active` | Runs awarded and not finished: `PENDING`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT` | `GET /api/shipments?status=…` (the set `useDeliveries` calls `active`) |
| Terminés | `completed` | What « Effectués » showed — delivered and cancelled runs with the money | unchanged |

- `?tab=completed` keeps working (old links); an unknown value falls back to
  `planned`.
- A pending card: job title and reference, the two cities, the price offered,
  the earliest proposed pickup (+ « n autres créneaux »), « Voir la course »
  and « Retirer l'offre ». Withdrawing uses the existing endpoint and refreshes
  the tab.
- An in-transit card: status pill in the client's vocabulary (the existing
  `shipments.status.*` labels), title and reference, the cities, the agreed
  price, the estimated pickup, linking to `/deliveries/[id]`.
- Each tab has its own empty state (`CenteredEmptyState`) and an error branch
  with « Réessayer » (gotcha 9). French and English.

## 6. « J'ai une demande » lives under « Contact & Aide » (#6)

> *In the quick links panel: put the 'I have an ask/question' in the section
> « contact & help »*

- The separate « J'ai une demande » quick link leaves `/profile`.
- `/help` gains a card « J'ai une demande » that opens the existing
  `FeedbackDialog`; so does `/driver/help`.
- `/help`'s title becomes « Contact & Aide », the words of the link that
  leads to it.
- The header's feedback launcher is untouched.

## 7a. « Mes factures » becomes « Historique des transactions » (#7a)

> *change the field « my bills » by « transaction history » … (bills and
> receipts for each one type)*

- The quick link and the page title read « Historique des transactions ». The
  URL stays `/profile/invoices`: emails already sent link to it.
- Two tabs, URL-held in `?tab=`:
  - **Demandeur** (`requester`, default) — the documents raised when a card was
    charged: the existing list, plus a **Type** column reading *Facture*,
    *Reçu de paiement* or *Avoir*, the same words the PDF prints
    (`invoicePdfProps().documentTitle`, sent by the server as `documentType`).
  - **Transporteur** (`carrier`), shown only to an account with the `carrier`
    role — each delivered run's statement line (date, job, reference, gross,
    commission, net, payout status) from `GET /api/carrier/earnings`, the
    period filter, and the period's *relevé d'activité* download.
- Each tab keeps its own empty and error states.

## 7b. Personal contact details, with a relative's phone (#7b)

> *personal contact details with a second phone field of another relative
> person of asker and carrier*

- `/profile` gains a « Coordonnées personnelles » card for every account:
  Prénom, Nom, Pseudo (§1), Téléphone, and « Personne à contacter » — the name
  and phone of someone close.
- Phones live in a new table, `user_contact_details` (one row per user,
  cascade on delete; migration `0038`), **not** on `user`: every `user: true`
  join in the DAL would otherwise carry them.
- `GET /api/users/me/contact` and `PUT /api/users/me/contact`, owner only.
  Phones are validated as `contactPhoneSchema` validates a job contact
  (French or international). All fields optional; an empty string clears.
  Saving Prénom + Nom also rewrites `user.name`.
- Who reads them: the owner, and staff on `/admin/users` → profile. Nobody
  else — no shipment, offer, listing or message projection includes them.

## 8. « Détails » on `/create` is optional (#8)

> *In the creation form of the ad, no need to have an obligatory field for
> details*

- Step 1's « Détails » loses its asterisk and its 5-character minimum, in the
  form schema and in `createListingSchema` (max 5000 stays).
- An empty description is stored as `""` (`listings.description` stays
  `NOT NULL`; no migration). The fragile note still folds into it.
- The job page, the summary step and the admin listing views show nothing for
  an empty description rather than an empty heading.

## 9. Pickup and delivery notes are « Détails – conditions d'accès » (#9)

> *Change in the title of the 2 fields « details » by « details - access
> conditions »*

- The two per-address notes on step 2 are titled « Détails – conditions
  d'accès (facultatif) » (EN « Details – access conditions (optional) »), with
  a placeholder naming what goes there (floor, code, parking).
- Beside a pasted map link the note stays « Décrivez l'endroit exact » and
  required — it is the only description of the spot.

## 10. The bottom bar fits on iPad (#10)

> *The titles of bottom fields are cut with my iPad.*

**Cause.** The three bottom bars (`BottomNav`, `DriverBottomNav`,
`AdminBottomNav`) were a fixed `88px` tall with the iOS safe-area inset as
padding **inside** that height (`viewportFit: "cover"`). On an iPad whose home
indicator reserves ~20px, a two-line label (« Demander un transport ») lost its
bottom.

**After.** Each bar is `calc(88px + env(safe-area-inset-bottom))` tall, the
inset stays as bottom padding, and the three shells pad their scroller by the
same `calc`, so the 88px of content is never shared with the inset.

## 11. Found on the way: account flags a client could set on itself

Better Auth accepts every `additionalFields` key on `sign-up/email` and
`update-user` unless the field says `input: false`
(`parseInputData`, better-auth 1.4.6). `isVerified` (the « vérifié » badge on
a public profile), `banned`, `stripeAccountId` and `stripeAccountStatus` did
not. All four are now `input: false`; the new name fields are the only
client-settable ones, each with a validator.

---

## Test coverage required

- §1: sign-up form validation (required, trimmed, lengths); `name` composed;
  Better Auth field config (validators, `input: false` on the four flags).
- §3: `TIMING_MODES` order; default mode; draft resume keeps exact.
- §4: `biddingDeadline` — exact unchanged, flexible runs to `pickupUntil − 6 h`,
  publishability unchanged, `null` runsUntil identical to before; `createListing`
  direct vs system account; `settleScheduled`; re-board of a started flexible
  window keeps its dates; form warning.
- §5: tab routing incl. `?tab=completed` and junk; pending and active panels
  render, empty and error states; withdraw.
- §6: quick link gone; help page opens the dialog.
- §7a: `documentType` per kind and issuer state; tabs; carrier tab hidden
  without the role.
- §7b: DTO validation; service writes both tables and `name`; route owner-only;
  no projection leaks the phones.
- §8: form and DTO accept an empty description; empty description not rendered.
- §9: labels.
- §10: the three bars carry the calc height.
- §11: sign-up and update-user refuse `isVerified: true` / `stripeAccountId`.
