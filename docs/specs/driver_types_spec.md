# Spec — Two kinds of driver

Nicolas, 17 Nov 2026: « the private driver is the in-house type of driver that is included in
Expeditoo company as driver, so it doesn't need the general submission, just the tick on the
driver application … then the admin will approve » · « separate the role: driver is the in-house
Expeditoo driver, carrier is the outside driver with complete form details » · « in the admin add
driver, give the option to add the driver from a registered or non-registered email (send an
invitation by email) ».

## 1. Vocabulary

| Word | Role | `carriers.kind` | Application | Sees money / bids |
|---|---|---|---|---|
| Chauffeur interne / In-house driver | `driver` | `private` | short | no |
| Transporteur / Carrier | `carrier` | `professional` | full (company, SIRET, documents) | yes |

Runs are executed through `shipments.carrier_id` / `driver_id`, not through the role
(`partyFor`), so an in-house driver awarded by an operator executes like any carrier.

## 2. Approval grants by kind

`approve`, `reinstate` and the admin onboarding call one grant: `kind = 'private'` → `driver`,
otherwise `carrier`; both write the `carrier_drivers` self-link (fleet check on assignment).
Nothing grants both. Accounts that already hold both keep them.

## 3. The application

`POST /api/carrier/application` body carries `kind` (`professional` by default).

| `kind` | Fields | Stored |
|---|---|---|
| `professional` | unchanged: companyName, siret, vat, legalForm, phone, address, city, postal, bio | as sent |
| `private` | contactPhone, addressLine, city, postalCode, bio | `companyName = "Expeditoo"`, `siret = null` |

- `kind` cannot change once the file is `submitted`, `under_review`, `approved` or `suspended`:
  `KIND_LOCKED` 409. A draft, rejected or deregistered file may switch.
- An in-house file has no required documents and no banking; submitting never emails « documents
  missing ». The admin alert names the type (« Chauffeur interne »).
- The form: a tick « Je suis chauffeur interne Expeditoo » swaps the company fields for the short
  set and hides the document and banking cards. The admin approves — nothing is automatic.

## 4. Admin: add an in-house driver

`POST /api/admin/carriers`, admin or operator. Body: `mode`, `email`, `name` (required for
`invite`), `contactPhone`, `addressLine`, `city`, `postalCode`, `bio?`, `vehicle {type,
maxWeightKg, plateNumber}`. Creates an `approved`, `private` file, one vehicle, role `driver`.

| `mode` | Meaning | Refusals |
|---|---|---|
| `existing` | the email already has an account; it is converted, nothing is sent | `ACCOUNT_NOT_FOUND` 404, `ALREADY_DRIVER` 409, `CARRIER_PROFILE_EXISTS` 409 |
| `invite` | no account: one is created and an **invitation email** with a set-password link is sent | `ACCOUNT_EXISTS` 409 (use `existing`), `ACCOUNT_CREATION_FAILED` 502 |

The invitation is `DriverInvitationEmail`, sent from the reset-password callback when the link's
`callbackURL` carries `invite=driver`. A failed email does not fail the request; Admin → Users
can resend a reset link. If the transaction fails, an account created by this call is deleted.

## 5. Roles in the admin

- `MANAGEABLE_ROLES` lists `driver` and `carrier` as separate chips; `dbRolesFor(r) = [r]`.
- **« Gérer le rôle » can add either** (Nicolas, 17 Nov: « give availability to add as in-house
  driver or carrier from manage roles, then automatically sort out on the drivers list »). It goes
  through `carrierService.grantRole(adminId, userId, role)`, so the role always comes with the file
  that earns it:
  - no file → an **approved** one is created (`driver` → `private`, company « Expeditoo »;
    `carrier` → `professional`, company = the account's name), contact details empty;
  - an open file (draft, submitted, under review, rejected, deregistered) → its kind is set to match,
    it is approved, its documents accepted, and the role granted;
  - an approved file → the role is simply added;
  - a `suspended` file → `CARRIER_SUSPENDED` 409 (`assignRole` answers `success: false`): reinstate first.
  The person is notified in the app. This reverses the 2.85.0 guard that refused the grant.
- Labels: `driver` « Chauffeur interne » / « In-house driver », `carrier` « Transporteur » /
  « Carrier ». `primaryRole` no longer folds `carrier` into `driver`; `carrier` outranks `driver`.
- `GET /api/admin/users?role=carrier,driver` filters on either; the Drivers tab uses it, so whoever
  is granted a driver role lands in the list with no further step.
- The dashboard's driver counts read both roles, once per account.

## 6. What an in-house driver can do

- Reach `/driver/*` (the guard now accepts `carrier` or `driver`) and run assigned shipments.
- Not bid: `/api/listings/:id/offers` and `/api/carrier/offers` require `carrier`; `takeJob`
  refuses a `private` file with `IN_HOUSE_DIRECT_ASSIGN_ONLY` 403. The job page says so.
- The admin « assign a driver » picker lists them by name with « Chauffeur interne » (their company
  is « Expeditoo » for all of them).

## 7. Admin: finishing a file on the applicant's behalf

Nicolas, 17 Nov: « give possibility from admin to finish up or complete the pending from the
user's side ».

- `PATCH /api/admin/carriers/:id` takes the application body (`upsertCarrierSchema`) and
  `POST /api/admin/carriers/:id/vehicles` a vehicle (`createVehicleSchema`); admin or operator
  (`adminUpdateApplication`, `adminAddVehicle`).
- Not locked by `submitted` / `under_review` — the point is to act on a file that is waiting. The
  kind may change until the file is `approved` or `suspended` (`KIND_LOCKED` 409). A SIRET another
  carrier holds is refused (`SIRET_ALREADY_REGISTERED`).
- Documents and the bank account are the person's own and are **not** editable here.
- UI: « Compléter le dossier » in the application detail opens `CarrierFileEditor` (kind tick,
  contact and company fields, add a vehicle). The detail says when the file is incomplete (no phone
  or no vehicle) — which is what a file created by « Gérer le rôle » looks like.

## Test coverage required

`carrier.service` (grant by kind, KIND_LOCKED, `grantRole` in its four cases, the two admin modes
and their refusals, `adminUpdateApplication`, `adminAddVehicle`), `user.service` (assignRole
delegates to the carrier service, several-role filter), `role-groups`, `primary-role`, the
application form (tick swaps fields, what is sent), the admin dialog (mode toggle, no company
fields), the role dialog (both roles offered), `JobBidSection` (in-house note), `takeJob`
(refused), the DTOs, the invitation link and mail, the migrations journal.
