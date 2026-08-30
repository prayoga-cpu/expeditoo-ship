# Testing mocks — what is fake and how to finish it

The repo is in **user-testing mode**. Every MVP journey now walks end to end through
the UI, but four things are deliberately mocked because they need infrastructure or
credentials only you can provide.

Every mock is marked in code with the same grep marker:

```bash
grep -rn "TODO(EXPEDITOO-TESTING)" src/ scripts/ .env.local
grep -rn "TODO(EXPEDITOO-TESTING)" ../expedion_encheres/lib ../expedion_encheres/vercel-build.sh
```

**Nothing ships to production while those commands return matches.** 13 markers in
`expeditoo-ship`, 9 in `expedion_encheres` at the time of writing.

---

## 1. Payments — `MOCK_PAYMENTS`

**The client pays at booking, not on delivery** — accepting an offer charges the
card outright (`docs/specs/payment_at_booking_spec.md`). What is mocked is that
charge: rather than guess at your Stripe test setup, `chargeForShipment` writes
the row straight to `captured` with a synthetic `pi_mock_<shipmentId>` intent.
Delivery then schedules the payout and raises the invoice against it, computing
the commission exactly as the real path does. **The real Stripe code path is
untouched when the flag is off.**

Two things are *not* mocked and must not be confused with one:

- **An Expedion-origin job charges nobody, flag or no flag.** Its client paid in
  the Expedion app when they accepted the quote, so the row is written
  `source='expedion'`, `captured`, with no PaymentIntent. That is the real
  behaviour of that lane, which is why it is checked *before* the flag.
- **`isMockIntent` decides by id, never by the flag**, so a real `pi_...` stays
  real while the flag is on and a `pi_mock_...` stays recognisable after it is
  turned off.

| What is mocked | Where | What you must do |
|---|---|---|
| Flag helper + synthetic intent prefix | `src/lib/stripe/mock-payments.ts:13` | Delete the file once the real flow lands, then drop its imports from `payments.service.ts` and `listings.service.ts` |
| `chargeForShipment` skips Stripe | `src/server/services/payments.service.ts:130,187` | Nothing to build — the real branch beside it already confirms an off-session PaymentIntent against the card saved at posting. Just stop setting the flag |
| `refundForShipment` skips the refund for `pi_mock_` ids | `src/server/services/payments.service.ts:299` | Remove the `isMockIntent` guard. **Purge `pi_mock_` rows from the DB first** — they have no real PaymentIntent to refund |
| The card a direct job needs before going live is not demanded | `src/server/services/listings.service.ts:47` | Remove the early return in `assertPayable`. `/create`'s payment step already collects the card for real, against your Stripe test keys |
| `MOCK_PAYMENTS=true` in the local env | `.env.local:93` | Delete the line. **Never set this flag in production** |

**Purge before you switch it off.** Any `pi_mock_` row is a captured payment
with no money behind it. Left in place, `/carrier/trips` → Effectués reports
earnings that do not exist and a refund on one silently succeeds.

## 2. Expedion → Expeditoo escalation bridge

**The bridge is live.** `POST /api/expedion/quotes/:id/paid` calls
`expedionService.markPaid`, which stamps `escalateAfter`, and the Expedion payment
server does call it — `api/confirm-payment.js` in `expedion_encheres` verifies the
Checkout session with Stripe and posts here. Auto-escalation is no longer dead code.

What is still mocked is the *demo data*, not the wiring: a seed script fabricates a
paid quote so you can watch the sweep fire without going through Stripe.

```bash
npx tsx src/scripts/seed-expedion-demo.ts   # idempotent; prints a curl crib sheet
```

| What is mocked | Where | What you must do |
|---|---|---|
| Fake platform shipper `expedion-system@expeditoo.test` owns escalated listings (no credentials, no Better Auth row) | `src/scripts/seed-expedion-demo.ts:47` | Create a real platform-owned shipper account and point `EXPEDION_SYSTEM_USER_ID` at it |
| Fabricated `DEMO-DEVIS-001` quote inserted directly at `status=paid` | `src/scripts/seed-expedion-demo.ts:68` | Real quotes must arrive from the Flutter app via `POST /api/expedion/quotes` and reach `paid` through a payment webhook. **Delete this row before production** |
| `escalateAfter` forced to NOW | `src/scripts/seed-expedion-demo.ts:111` | Only so the demo does not wait. Real quotes get `now + EXPEDION_ESCALATE_AFTER_HOURS` from `markPaid` already — stop seeding the timestamp, nothing to wire |
| `EXPEDION_SYSTEM_USER_ID` → fake shipper | `.env.local:49` | Point at the real platform account |
| `EXPEDION_CATEGORY_ID` → seeded `encheres` category | `.env.local:53` | Confirm the category belongs in production or repoint |
| `EXPEDION_ESCALATE_AFTER_HOURS=0.01` (~36 s) | `.env.local:57` | Restore a real window (48). Note: a literal `0` is **rejected** and silently falls back to 48h |

### Two structural risks that were recorded here — both now fixed

Left in place as a record, because the second one is easy to "fix" a second time and
the first depends on code that looks redundant until you know why it is there:

1. **Duplicate listings on retry — fixed.** `escalateQuote` now looks for an
   existing listing by `externalRef` and adopts it, and tracks `createdListing`
   so the catch **refuses to release the claim** once a listing exists
   (`expedion-escalation.service.ts`, the `if (createdListing)` branch). A stuck
   quote is visible and repairable; a duplicate is not. Do not "simplify" that
   branch into an unconditional release.
2. **Payment → `markPaid` wiring — fixed.** `POST /api/expedion/quotes/:id/paid`
   is the caller, and `expedion_encheres/api/confirm-payment.js` posts to it after
   verifying the Stripe Checkout session.

---

## 3. Expedion Enchères (Flutter) — deployment config

The committed build shipped with **no backend at all**: `vercel-build.sh` passed no
`--dart-define`, so the deployed web app had an empty Airtable PAT, no Expedion API
URL or key, and a payment server pointing at `localhost:4242`. All of it is now
driven by build-time defines with safe defaults.

| What is mocked | Where | What you must do |
|---|---|---|
| Backend config with empty/localhost defaults | `vercel-build.sh:18-31` | In Vercel → Settings → Environment Variables set `EXPEDION_API_BASE_URL`, `EXPEDION_API_KEY`, `AIRTABLE_PAT`, `AIRTABLE_PAT_TRANSPORTEURS`, `PAYMENT_SERVER_URL`, `APP_PUBLIC_URL` |
| Payment server defaults to `http://localhost:4242` | `lib/backend/api_requests/api_calls.dart:18-25` | Deploy `tools/local_payment_server.js` (or a fixed Cloud Function) publicly and set `PAYMENT_SERVER_URL` |
| Stripe redirect origin falls back to `APP_PUBLIC_URL` | `paiement_model.dart:38-47`, `page_validation_devis_widget.dart:1246,1293`, `w_e_b_form_d_dpay_direct_widget.dart:2935` | Set `APP_PUBLIC_URL` to the real origin; verify the success redirect carries `recordId` and lands on `/success` |
| **SECURITY: spoofable mark-paid**, gated behind `ALLOW_UNVERIFIED_MARKPAID` which **defaults to `true`** | `paiement_success_widget.dart:63-97` | Before any real payment: deploy the payment server, build with `--dart-define=ALLOW_UNVERIFIED_MARKPAID=false`, then **delete the fallback branch and the flag entirely**. While true, anyone visiting `/success?recordId=<id>` can mark an unpaid quote paid |
| Best-effort bordereau upload from the express card | `formulaire_demande_de_devis_retrait_aux_encheres_widget.dart:169`, `formulaire_de_devis_par_bordereau_widget.dart:80` | If the file was picked while signed out, Storage may reject the draft path and the attachment is silently dropped. Expose a public storage-path helper in `upload_data.dart` and recompute under the signed-in user's prefix |
| Quote intake still writes to Airtable with an embedded PAT | `api_calls.dart:28` and sibling `CreateAirtable*` calls | **Larger follow-up:** repoint intake onto `/api/expedion/quotes` server-side so the PAT leaves the client bundle. Until then Airtable is a second, unsynchronized store of record |

---

## 4. Solo-carrier self-assignment

Approving a carrier grants the `carrier` **and** `driver` roles and enrols the owner
as a driver in their own fleet (`carrier.service.ts` → `enrolAsOwnDriver`). That pair
is what lets the carrier who wins a job reach `/driver/*` and pass `assignDriver`'s
fleet check, so they can press **Start job** on a `PENDING` shipment and walk it to
delivered.

It is the honest model for a market of owner-drivers, but it is not a fleet feature:
for real multi-driver carriers, replace it with a driver invite flow that grants the
role and the fleet link to the *invitee*, and stop enrolling the owner automatically.
Marked with `TODO(EXPEDITOO-TESTING)` at the helper.

**Legacy carriers:** anyone approved before this change holds neither the driver role
nor a fleet link. Re-approving them backfills it — every write in the helper is
idempotent, so the already-approved branch runs the enrolment and returns.

---

## 5. Photo location stamp — fonts on the host

`shipment-photo` evidence is stamped with its GPS fix **into the pixels** before the
object is stored, so no unstamped copy exists anywhere (`photo-stamp.service.ts`,
`docs/specs/shipment_photos_spec.md`). The band is drawn through librsvg, and librsvg
finds fonts through fontconfig — i.e. through whatever the host happens to provide.

Locally that is the system font stack and the band renders correctly. On a Vercel
build image with no system fonts it renders **without glyphs**: a coloured bar and no
text. Marked with `TODO(EXPEDITOO-TESTING)` at the service.

Finishing it means committing a TTF to the repo and pointing `FONTCONFIG_PATH` at it —
a licensing and bundle-size decision, not a code one. Until then the loss is the
convenience, not the evidence: the database row is unaffected and **every surface
prints the same three lines as text beside the photo**, so a fontless deployment still
shows where and when the photo was taken.

---

## 6. Known gaps left standing (not mocked — just not done)

- **Payouts stop at `scheduled`.** `executePayout` has no callers and banking details
  are never forwarded to Stripe (`carrier.service.ts` TODO). A carrier earnings *view*
  exists at `/carrier/trips` → Effectués, but it reports €0 net because the platform
  retains 100% while `COMMISSION_RATE` is 1.0 — nothing moves money. This is the
  documented Phase C boundary.
- **No realtime shipment data.** Only the notification bell is pushed over Ably; the
  shipment-data path (`publishDataUpdate` server-side, the `data:update` handler
  client-side) exists on both ends but was never connected, and shipment queries have
  `refetchOnWindowFocus: false` with a 60 s `staleTime`.
- **No push channel to the Flutter app at all** — no Ably/FCM/WebSocket dependency.
  The buyer's tracking screen updates only on pull-to-refresh.
- **v1 vocabulary survives** in ~50 files (`seller`/`buyer`/`transporter` identifiers).
  The live paths that mattered are fixed; the rest is cosmetic debt.
- **Existing users may hold zero roles** — anyone who signed up while the `'buyer'`
  enum bug was live got no role at all. Consider a one-off backfill inserting
  `shipper` for role-less users.

---

## How to run the demo flows

### Shipper → carrier → delivery → money

```bash
# .env.local already has MOCK_PAYMENTS=true
pnpm dev
```

1. Sign up (email signup works now — it inserted the invalid `'buyer'` role before).
2. Post a transport job through the 4-step form → it appears on the board and in
   **My jobs** (`/listings/me`).
3. In a second browser, sign up as another user, then grant the carrier role. Either
   approve a carrier application at `/admin/applications` (the screen hits the real
   `carrier-applications` routes now), or insert the role directly for speed.
4. As the carrier, open the job → the bid form is mounted on the job detail page.
5. As the shipper, accept the offer → payment is authorised with a `pi_mock_` intent
   and a shipment is created.
6. Assign a driver, then walk `ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED` in
   `/driver/shipments/[id]`, finishing with the proof-of-delivery upload.
7. Delivery captures the mock payment, takes the commission at the configured
   rate — 100% during the testing phase, so the payout row is 0 — and records it.
8. Both sides can review from the delivery detail page.

### Expedion escalation

```bash
npx tsx src/scripts/seed-expedion-demo.ts     # creates a paid DEMO quote, due now
# the script prints the exact curl commands for:
#   - triggering /api/cron/expedion-escalate  (CRON_SECRET)
#   - manual force-escalation                 (EXPEDION_ADMIN_API_KEY)
#   - reading the quote's event feed
```

The escalated quote becomes an open listing carriers can bid on, and shipment status
changes write back onto the quote row.
