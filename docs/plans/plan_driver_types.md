# Plan — Two kinds of driver: the in-house driver and the outside carrier (2.87.0)

Spec: `docs/specs/driver_types_spec.md`. Client feedback of 16–17 November 2026 (Nicolas).

## The decision

- `driver` role = **in-house Expeditoo driver** (`carriers.kind = 'private'`). Runs what Expeditoo
  assigns, bids on nothing, sees no money.
- `carrier` role = **outside driver** who passed the full application (`kind = 'professional'`).
  Bids, sees offers and earnings.
- Until now approval granted both roles together. It now grants the one the file's kind names.

## Steps

1. Migration `0048`: `carriers.siret` becomes nullable (an in-house driver has none).
2. DTOs: `upsertCarrierSchema` splits by `kind`; `createDriverSchema` (admin) gets a `mode`
   (`existing` | `invite`) and loses company name, SIRET, legal form and VAT.
3. `carrier.service`: application upsert per kind, approval and reinstatement grant by kind,
   admin onboarding by mode, invitation email, no required documents for an in-house file.
4. `user.service.assignRole` sends `carrier` / `driver` to `carrierService.grantRole`, which creates
   or approves the file that earns the role. `getUsers` accepts `role=carrier,driver`. Dashboard
   driver counts read both roles.
5. Roles stop being one chip: `role-groups`, `primary-role`, role dialog, users table, labels.
6. `/driver/*` guard accepts `carrier` as well as `driver`; the job page tells an in-house driver
   why there is no form; `takeJob` refuses an in-house driver.
7. Onboarding form: an « Chauffeur interne Expeditoo » tick that swaps the form for the short one;
   documents and banking hidden for it. Admin list and file show the kind and a missing SIRET.
8. Admin « Add in-house driver »: registered account or invitation, short form, invitation email.
9. Admin completes a file for the applicant: `PATCH /api/admin/carriers/:id`, `POST …/vehicles`,
   `CarrierFileEditor` in the application detail.
10. FR/EN copy, tests, release records.

## Not in scope

- Existing accounts that hold both roles are left as they are. An admin can remove one by hand.
- Payout rows for an in-house driver (Expeditoo pays them as staff). Still written at delivery,
  never shown to them; the client decides what happens next.
- The chat-quote lane (`thread-offers`) does not yet refuse an in-house driver.
