# Launch readiness — spec

Status: **current** (2.64.0). Plan: `docs/plans/plan_launch_readiness.md`.

Four things the client needs before real money moves: documents that can be
factures, proof that Stripe is wired, a way to pay drivers they can follow, and
an Expedion app that no longer depends on Airtable.

---

## A. Company identity

### A.1 Storage

`company_identity`, one row (`id = 'default'`). Columns, all nullable text:
`legal_name`, `legal_form`, `capital`, `address`, `siret`, `rcs`,
`vat_number`, `vat_rate`, `billing_email`, `publication_director`, `host`;
plus `updated_by` (FK `user`, set null), `created_at`, `updated_at`.

Nothing is ever pre-filled server-side. An empty column means "not stated".

### A.2 Admin form — `GET|PUT /api/admin/company`

- Admin **or finance** (the same people as the platform fee). Anyone else:
  `403 FORBIDDEN_NOT_ADMIN`, before any read or write.
- `PUT` body: any subset of the eleven fields, as strings. `.strict()` — an
  unknown key is a 400. Every value trimmed; `""` stores **null** (so the field
  falls back to its variable, §A.3).
- Validation (400 `VALIDATION_ERROR`, `issues[].path` = the field,
  `issues[].message` = the code):
  | Field | Rule | Code |
  |---|---|---|
  | `siret` | spaces removed; 14 digits | `SIRET_14_DIGITS` |
  | `vatNumber` | spaces removed, upper-cased; `^[A-Z]{2}[0-9A-Z]{2,13}$` | `VAT_NUMBER_FORMAT` |
  | `vatRate` | `,` read as `.`; a number 0–100 | `VAT_RATE_RANGE` |
  | `billingEmail` | an email | `EMAIL_FORMAT` |
  | others | ≤ 80 / 120 / 160 / 300 characters | zod default |
- Response (both verbs): `{ values, documentType, missing, updatedAt }`.
  `values` is each field's **effective** value — saved, else the matching
  variable, else null. `documentType` is `invoice` when the issuer is complete,
  `receipt` otherwise; `missing` lists, in this order, what keeps it a receipt:
  `legalName, legalForm, address, siret, rcs, vatRate`, and `vatNumber` only
  when the rate is above 0.
- The form offers `Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723,
  États-Unis` as the starting value of an **empty** host field; it is stored
  only when the admin saves.

### A.3 What documents print — `invoiceIssuer(stored?)`

- Field by field, the saved value wins; an empty saved value falls back to its
  variable (`INVOICE_ISSUER_NAME`, `_LEGAL_FORM`, `_CAPITAL`, `_ADDRESS`,
  `_SIRET`, `_RCS`, `_VAT_NUMBER`, `_EMAIL`, `INVOICE_VAT_RATE`).
- **Complete** = a *stated* legal name (saved or variable — the "Expeditoo"
  display fallback does not count) + legal form + address + SIRET + RCS + a
  parseable VAT rate + a VAT number when the rate is not 0. A complete issuer
  makes every document a *Facture*; otherwise a *Reçu de paiement* footed « ne
  vaut pas facture », as before.
- `companyIdentityService.issuer()` is what every server path passes:
  `/api/user/invoices` (labels), `/api/user/invoices/[id]/pdf`,
  `/api/user/invoices/statement`, and the emailed document.

### A.4 Mentions légales — `GET /api/public/company`

- Public, unauthenticated, dynamic. Returns `legalName, legalForm, capital,
  address, siret, rcs, vatNumber, publicationDirector, host` (effective values)
  — never `vatRate` or `billingEmail`.
- Each pending row of `marketing.legalNotice.identity` carries a `field`. The
  page replaces a pending row's value with the saved one and drops its pending
  style; an unsaved row keeps its placeholder. The « valeurs à compléter » note
  shows only while at least one row is still pending.

### A.5 Failure

`issuer()` and `getPublic()` never throw on a read failure (e.g. the table is
missing because the migration has not run): they log and fall back to the
variables — the conservative direction, a receipt rather than a facture.

---

## B. Stripe check — `GET /api/admin/stripe-status`

Admin or finance; otherwise 403 before Stripe is called. Read-only: nothing is
written to Stripe or the database. **No key is ever returned** — only its mode.

### B.1 Key modes

From the prefix alone: `sk_live_`/`rk_live_` → live, `sk_test_`/`rk_test_` →
test, `pk_live_`/`pk_test_` likewise for the publishable key; empty → missing;
anything else → unknown.

### B.2 Webhook endpoints

`stripe.webhookEndpoints.list({ limit: 20 })`, 8 s timeout. Each endpoint is
classified:
- `thisApp` — path `/api/stripe/webhook` on a host this deployment knows
  (`NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`,
  `VERCEL_URL`);
- `thisPathOtherHost` — that path on another host (an old URL);
- `other` — anything else (e.g. Expedion's n8n automations).

`coversHandledEvents` is true when it is subscribed to `*` or to every event in
`HANDLED_STRIPE_EVENTS` (`account.updated`, `payment_intent.succeeded`).

Attaching a custom domain to the Vercel project does **not** require changing
the endpoint: the `*.vercel.app` production address keeps serving. Only a
redirect from it would break the webhook (Stripe does not follow redirects).

### B.3 Real charges

`payments` with `source = 'stripe'`, status `captured` or `refunded`: count,
first and last `created_at` of those whose intent is **not** `pi_mock_…`, and
the mock count apart.

### B.4 Heartbeat

`stripe_webhook_heartbeat` (one row): `last_event_at`, `last_event_type`,
`last_event_livemode`. Written by `handleWebhook` **after** the signature
verifies and before the event is handled. A failed write is logged and never
fails the event (Stripe would retry an event that was handled).

### B.5 Checklist

| Check | ok when | otherwise |
|---|---|---|
| `liveKeys` | secret **and** publishable keys live | todo |
| `mockOff` | `MOCK_PAYMENTS` not `"true"` | **fail** |
| `chargesEnabled` | account reachable and `charges_enabled` | todo; fail if unreachable |
| `webhookEndpoint` | a `thisApp` endpoint, `enabled`, covering the events | todo; fail if unreachable |
| `webhookReceived` | a heartbeat exists | todo |
| `firstRealPayment` | at least one real charge | todo |

A Stripe call that fails is reported (`reachable: false, error`) — the page
never 500s because Stripe did.

---

## C. Expedion profile — `GET|PUT /api/expedion/me/profile`

Replaces Airtable USERS (sign-up, personal space, profile edit) in the Flutter
app.

- Auth: `requireExpedionCaller`. Only `via: 'session'` may read or write; a
  Firebase token or a shared key answers `403 PROFILE_NEEDS_ACCOUNT` (such a
  caller may have no `user` row, and an app key must not write anyone's
  profile).
- `GET` → `{ email, firstName, lastName, phone, address }`, `address` =
  `{ line1, line2, zip, city, country }` from the user's **default**
  `addresses` row (`street`, `details`, …), or null. An empty `details` reads
  as `line2: null`.
- `PUT` body, `.strict()`, every key optional:
  `firstName`, `lastName` (the name rules of sign-up), `phone` (a French or
  E.164 number, stored **E.164**; `""` clears), `address` (`line1`, `zip`,
  `city`, `country` required non-empty; `line2` optional / null / `""`).
  The **whole body is validated before any write**. Names and phone go through
  `userContactService.updateOwn` (one transaction; `name` re-composed); the
  address updates the default row in place, or creates one labelled `home`
  (`isDefault: true`). The two writes are not one transaction.
- Errors use the Expedion envelope: 400 `VALIDATION_ERROR` with `details` per
  field, 401 from auth, 403 as above, 404 `USER_NOT_FOUND`.

---

## D. Driver payouts

Decision (owner, 2026-10-17, "you decide"): **drivers ask, operators pay by
bank transfer**, as built in `withdrawals` (2.37–2.60). The driver requests
their whole available balance from « Mes gains », follows it through
*Demandé → Approuvé → Payé / Refusé* with the transfer reference, and is
notified at each step. No Stripe Connect transfer is made: that waits on the
client's legal choice of a licensed provider.

Added here: each request in `/admin/withdrawals` shows the IBAN and BIC **last
four** the driver typed (`carriers.iban_last4`, `bic_last4`, never the full
account) to check against the RIB in their file, or warns that none is on
file.

---

## E. Not in this release

- A real live charge cannot be made by code: it needs a person and a card
  (STATUS Operator to-do). The checklist turns green when it happens.
- The Stripe destinations pointing at n8n stay on while the client's current
  Expedion app runs on Airtable; they are switched off the day the new app
  replaces it.

---

## Test coverage required

- Company identity service: permissions (admin, finance, refused before I/O);
  effective values; `missing` for empty / complete / VAT-charged; `""` → null
  and normalisation; each malformed field refused before writing; unknown key
  refused; issuer fallback on a read failure; public view has exactly nine
  keys.
- `invoiceIssuer(stored)`: complete from the row; saved beats variable, empty
  falls back; brand name alone is not complete; no row = variables.
- Stripe status: key modes; endpoint classification; host collection;
  permission before Stripe; all-green; other endpoints not counted; missing
  event not counted; todo states; Stripe failure → fail, not throw; mock on →
  fail; no key in the payload.
- Webhook heartbeat: recorded after verification; not on a bad signature;
  handling continues when the stamp fails.
- Expedion profile: shape; null address; three non-session callers refused
  for both verbs; E.164; clear; update in place; create `home`; nothing
  written on any invalid part.
- Legal notice rows: filled vs pending; unchanged without data; every pending
  row has a field in FR and EN.
- Panels: every key resolves in FR and EN; missing list; host default; field
  error under the field; error states; old-address label.
- Withdrawal queue: destination shown; warning without an IBAN.
