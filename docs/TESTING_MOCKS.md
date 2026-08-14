# Testing mocks — what is fake and how to finish it

The repo is in **user-testing mode**. Every MVP journey now walks end to end through
the UI, but four things are deliberately mocked because they need infrastructure or
credentials only you can provide.

Every mock is marked in code with the same grep marker:

```bash
grep -rn "TODO(EXPEDITOO-TESTING)" src/ scripts/ .env.local
grep -rn "TODO(EXPEDITOO-TESTING)" ../expedion_encheres/lib ../expedion_encheres/vercel-build.sh
```

**Nothing ships to production while those commands return matches.** 12 markers in
`expeditoo-ship`, 9 in `expedion_encheres` at the time of writing.

---

## 1. Payments — `MOCK_PAYMENTS`

The Stripe hold was never real: the PaymentIntent was created with `confirm: false`
and no caller ever passed a payment method, so every payment sat at `pending`,
capture threw `PAYMENT_NOT_AUTHORISED` at delivery, and payout never ran. Rather than
guess at your Stripe test setup, the money chain now runs behind a flag.

With `MOCK_PAYMENTS=true`, accepting an offer records the payment as authorised with a
synthetic `pi_mock_<shipmentId>` intent; delivery captures it, computes the 10%
commission exactly as the real path does, and records the payout. **The real Stripe
code path is untouched when the flag is off.**

| What is mocked | Where | What you must do |
|---|---|---|
| Flag helper + synthetic intent prefix | `src/lib/stripe/mock-payments.ts:11` | Delete the file once the real flow lands, then drop its imports from `payments.service.ts` |
| `authoriseForShipment` skips Stripe | `src/server/services/payments.service.ts:41,105` | Collect a card via SetupIntent, pass `paymentMethodId` (or return `clientSecret` for client confirmation), and mark the row authorised from the `amount_capturable_updated` webhook instead of synchronously |
| `captureForShipment` skips capture for `pi_mock_` ids | `src/server/services/payments.service.ts:202` | Remove the `isMockIntent` guard. **Purge `pi_mock_` rows from the DB first** — they have no real PaymentIntent to capture |
| `releaseForShipment` skips cancel | `src/server/services/payments.service.ts:232` | Same: remove the guard, purge mock rows first |
| `MOCK_PAYMENTS=true` in the local env | `.env.local:41-46` | Delete the block. **Never set this flag in production** |

---

## 2. Expedion → Expeditoo escalation bridge

The bridge is mechanically sound but starved: `expedionService.markPaid` is the only
writer of `escalateAfter` and **has zero callers**, so no real quote ever becomes due
and the 10-minute cron sweeps an empty set. A seed script gives you a working demo
without that wiring.

```bash
npx tsx src/scripts/seed-expedion-demo.ts   # idempotent; prints a curl crib sheet
```

| What is mocked | Where | What you must do |
|---|---|---|
| Fake platform shipper `expedion-system@expeditoo.test` owns escalated listings (no credentials, no Better Auth row) | `src/scripts/seed-expedion-demo.ts:47` | Create a real platform-owned shipper account and point `EXPEDION_SYSTEM_USER_ID` at it |
| Fabricated `DEMO-DEVIS-001` quote inserted directly at `status=paid` | `src/scripts/seed-expedion-demo.ts:68` | Real quotes must arrive from the Flutter app via `POST /api/expedion/quotes` and reach `paid` through a payment webhook. **Delete this row before production** |
| `escalateAfter` forced to NOW | `src/scripts/seed-expedion-demo.ts:111` | Wire `markPaid` so it stamps `now + EXPEDION_ESCALATE_AFTER_HOURS` when payment settles, then stop seeding the timestamp |
| `EXPEDION_SYSTEM_USER_ID` → fake shipper | `.env.local:49` | Point at the real platform account |
| `EXPEDION_CATEGORY_ID` → seeded `encheres` category | `.env.local:53` | Confirm the category belongs in production or repoint |
| `EXPEDION_ESCALATE_AFTER_HOURS=0.01` (~36 s) | `.env.local:57` | Restore a real window (48). Note: a literal `0` is **rejected** and silently falls back to 48h |

### Two structural risks recorded, deliberately not fixed

These are pre-existing design bugs, not mocks — fix them before real money flows:

1. **Duplicate listings on retry** (`expedion-escalation.service.ts:194`) — listing
   creation sits outside the claim's cleanup. If the bridge-stamp or quote-update
   after creation fails, the catch releases `escalatedAt` while the listing exists,
   and the next sweep mints a second one. *Fix:* make creation + stamp + quote update
   one transaction, or check for an existing listing with `externalRef = quote.id` first.
2. **No payment → `markPaid` wiring** (`expedion.service.ts:423`) — call it from the
   payment webhook when a quote's payment settles. Until then auto-escalation is dead
   code and only manual admin force-escalation works.

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

## 4. Known gaps left standing (not mocked — just not done)

- **Payouts stop at `scheduled`.** `executePayout` has no callers and banking details
  are never forwarded to Stripe (`carrier.service.ts` TODO). Carriers have no earnings
  screen. This is the documented Phase C boundary.
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
7. Delivery captures the mock payment, takes the 10% commission and records the payout.
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
