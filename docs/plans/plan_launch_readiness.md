# Launch readiness — plan

**Spec:** [`launch_readiness_spec.md`](../specs/launch_readiness_spec.md)
**Release:** 2.64.0 · **Created:** 2026-10-17 · **Status:** ✅ Completed

## Why

The client asked on WhatsApp (2026-10-17): _« What about Stripe and
informations of payment (Airtable or other)? »_. The owner answered with a
status table and asked for every row of it to be made true:

| Row | What was missing |
|---|---|
| Stripe on production | Nothing a laptop could prove: production's keys are Sensitive in Vercel, so whether they are live, whether the webhook arrives and whether a real card has ever been charged were all unknowable. |
| Invoices | Every document is a « reçu de paiement » because the company's legal identity lives in `INVOICE_ISSUER_*` variables that only a developer can set — and nobody has them. |
| Driver payouts | The request → approve → pay flow exists; the operator's queue did not say where to send the money. |
| Airtable | Expeditoo no longer touches it, but the new Expedion app still wrote every sign-up's name, address and phone to Airtable USERS and read them back. |

## Steps

1. **Company identity (§A).** `company_identity` table (one row), admin/finance
   form at `/admin/settings`, `invoiceIssuer(stored)` merges it over the
   variables field by field, a stated legal name becomes a facture
   requirement, `GET /api/public/company` feeds the mentions légales.
2. **Stripe check (§B).** `stripe_webhook_heartbeat` table stamped by the
   webhook after a signature verifies; `GET /api/admin/stripe-status` reads key
   modes, the account, the webhook endpoints, the heartbeat and the real-charge
   count; a checklist card on `/admin/settings`.
3. **Expedion profile (§C).** `GET|PUT /api/expedion/me/profile` over
   `user`, `user_contact_details` and the default `addresses` row, for the
   Flutter app to replace Airtable USERS. The Flutter side is done in
   `expedion_encheres` (uncommitted there; see STATUS 2.64.0).
4. **Payout queue (§D).** IBAN/BIC last four on each request in
   `/admin/withdrawals`.
5. Migration `0039_company_identity_stripe_heartbeat` (additive), tests,
   release 2.64.0.

## Files

- `src/db/schema/company-identity.ts`, `src/db/schema/stripe-webhook-heartbeat.ts`,
  `src/db/migrations/0039_company_identity_stripe_heartbeat.sql`
- `src/server/{dal,dto,services}/company-identity.*`,
  `src/server/services/stripe-status.service.ts`,
  `src/server/dal/stripe-webhook-heartbeat.dal.ts`,
  `src/server/{dto,services}/expedion-profile.*`
- `src/app/api/admin/{company,stripe-status}/route.ts`,
  `src/app/api/public/company/route.ts`,
  `src/app/api/expedion/me/profile/route.ts`
- `src/lib/invoice-issuer.ts`, `src/lib/invoice-pdf-props.ts` and the three
  rendering callers
- `src/features/app/platform-settings/ui/{CompanyIdentityPanel,StripeStatusPanel}.tsx`,
  `src/features/marketing/hooks/useLegalIdentity.ts`,
  `src/features/app/withdrawals/ui/WithdrawalQueue.tsx`

## Dependencies

- Migration `0039` must run on production **before** the deploy. The code
  degrades if it does not (§A.5, §B.4), but the form cannot save.
- The Expedion app's Airtable removal ships only when that app is deployed;
  until then the client's current Expedion app keeps using Airtable and n8n.
