# Spec — the job reference (« référence de l'annonce »)

Plan: `docs/plans/plan_listing_reference.md`. Client request, 2026-09-29:
_"add the field « ad reference » for users (asker and shipper) … and
shipper-carrier"_.

## 1. What it is

Every job (`listings` row) carries a **reference**: a positive integer, issued
by the database, unique across all jobs, never reused and never edited. It is
the one number a requester, a transporter, a driver and support can all say
to each other — on the phone, in a thread, in an email — and mean the same
job.

- Six digits from the start: the first reference is **100001**. It grows to
  seven digits after 899 999 jobs; nothing assumes a width.
- Digits only. No prefix, no letters, no check digit: it is read aloud and
  typed on a phone keypad.
- **Both inlets get one**, from the same sequence. A direct request and an
  escalated Expedion job are numbered alike; the reference says nothing about
  origin.
- It is not the listing `id` (a nanoid, which stays the URL and the foreign
  key), not the Expedion quote id (`external_ref`), not the bordereau number,
  and not an invoice number.

## 2. Storage

Migration `0033_listing_reference.sql`:

| Object | Definition |
|---|---|
| sequence | `listing_reference_seq`, `integer`, `START WITH 100001`, owned by `listings.reference` |
| column | `listings.reference integer NOT NULL DEFAULT nextval('listing_reference_seq')` |
| constraint | `listings_reference_unique UNIQUE (reference)` |

Existing rows are **renumbered in creation order** (`created_at`, then `id`),
100001 upward, so the oldest job holds the lowest number. The sequence is then
set so the next insert follows the highest existing reference.

The column is **not** on `createListingSchema` or `updateListingSchema`. A
client sending `reference` has it stripped by Zod like any unknown key; no
code path writes it — the database's default is its only writer.

## 3. Display

One component, `ListingReference` (`src/features/app/listing/ui`):

- Text: `listingReference.label` — FR « Réf. {reference} », EN
  "Ref. {reference}". Mono, muted, tabular numerals.
- `copyable`: adds an icon button, accessible name
  `listingReference.copy`, that writes the **bare number** to the clipboard
  and toasts `listingReference.copied`. If the clipboard is unavailable or
  refuses, it toasts `listingReference.copyFailed`; it never throws.

Where it appears (every screen where a party to the job looks at that job):

| Surface | Who | Variant |
|---|---|---|
| `/listing/[id]` header (`JobDetail`) | requester, carrier, operator | copyable |
| « Mes demandes » row (`MyRequestsPanel`) | requester | plain |
| « Mes demandes » delivered card (`DeliveredRequestCard`) | requester | plain |
| `/deliveries` card (`DeliveryCard`) | requester, carrier | plain |
| `/deliveries/[id]` header (`DeliveryDetail`) | requester, carrier | copyable |
| `/driver/shipments/[id]` header | driver, carrier | copyable |
| message thread context card (`MessageDetail`) | both parties | plain |
| completed trip card (`CompletedTripCard`) | carrier | plain, replaces the old reference |
| award queue card (`AwardQueue`) | operator | plain |
| admin listings table, title cell (`ListingsTable`) | admin, operator | plain |

Not on the job-board card: a carrier who is not yet party to a job does not
need a number to quote, and the board finds a job by it anyway (§4).

A surface whose listing is missing (a shipment whose listing row no longer
resolves) renders **no** reference line — never a placeholder, never the
shipment id.

## 4. Search

`parseListingReference(input)` in `src/lib/listing-reference.ts` returns the
reference an input names, or `null`:

- Trims; accepts an optional leading `réf`, `ref`, `référence`, `reference`,
  `n°`, `no` or `#`, in any case, with an optional `.`, `:`, `#` or `-` after
  it; removes inner whitespace (`100 042`).
- What remains must be 6–10 digits, ≥ 100001 and ≤ 2 147 483 647
  (`integer` max). Otherwise `null`.

Consumers:

- **Board** (`listingsDal.browse`, `q`): when `q` parses, the condition is
  `reference = n OR <the existing full-text match>`; otherwise the full-text
  match alone, unchanged. Every other board filter still applies, so a
  referenced job that is not `open` or is past `expires_at` is not returned.
- **Admin listings table**: the title column's filter also matches the
  reference's digits as a substring, and a prefixed one (« Réf. 100042 »)
  exactly.
- **Completed trips** (`CompletedTripsPanel`): the client-side search matches
  the job reference.

## 5. Other readers

- **Drivers**: `reference` joins `DRIVER_LISTING_FIELDS`. It is not a
  commercial term (roles_spec.md §3).
- **Threads**: both `messages.dal.ts` listing column picks include
  `reference`. The listing is still narrowed; nothing else is added.
- **Earnings** (`earnings.service.ts` `toItem`): `reference` is the job
  reference as a string; the shipment id only when the listing is missing.
  It was `external_ref ?? shipmentId` — the Expedion quote id on one inlet and
  a raw id on the other. The statement PDF prints the same field.
- **"Request is live" notification and email** (listing_posted_feedback_spec.md
  §2): the bell message names the reference
  (`"<title>" (réf. 100042) est visible par les transporteurs.`), and the email
  shows `Référence : 100042` above the route.
- **Client confirmation page and email** (transport_status_confirmation_spec.md):
  `reference` is the Expedion bordereau number when the job came from a quote
  that has one, else the job reference. It used to fall back to the job
  *title*, which is not a reference. The page and the email now apply the
  same rule; the payload's shape does not change (still a string or null).

## 6. Edge cases

- **Two jobs created in the same transaction or instant**: the sequence
  serialises them; references are distinct, ordered by insert.
- **A failed insert** consumes a sequence value: references have gaps. Nothing
  may assume contiguity.
- **Deleted job**: its reference is never reissued.
- **Re-boarded job** (withdrawal, `reopenForRebid`): same row, same reference.
- **Escalation retry** adopting an orphaned listing: same row, same reference.

## 7. Test coverage required

- [ ] `parseListingReference`: bare digits; each accepted prefix, accented and
      not, any case; inner spaces; below 100001; 5 and 11 digits; letters;
      empty; exactly integer max, and one above it.
- [ ] Migration journal test passes with `0033` registered.
- [ ] Migration SQL: creates the sequence at 100001, backfills in
      `created_at` order, sets the sequence from the max, adds the unique
      constraint.
- [ ] `createListingSchema` strips a client-sent `reference`.
- [ ] `listingsDal.browse` with a reference `q` ORs the reference with the
      full-text condition; with a non-reference `q`, full text only.
- [ ] Driver redaction keeps `reference` on the listing.
- [ ] Earnings `reference` is the job reference, falling back to the shipment
      id only with no listing.
- [ ] Confirmation view/email: bordereau when present, else job reference,
      never the title.
- [ ] Listing-posted notification and email carry the reference.
- [ ] `ListingReference`: renders the label; copy writes the bare number and
      toasts; a rejecting clipboard toasts the failure.
- [ ] `JobDetail`, `DeliveryDetail`, thread header show it; FR/EN parity.
