# Spec — Two kinds of driver

Nicolas, 17 Nov 2026: « the private driver is the in-house type of driver that is included in
Expeditoo company as driver, so it doesn't need the general submission, just the tick on the
driver application … then the admin will approve » · « separate the role: driver is the in-house
Expeditoo driver, carrier is the outside driver with complete form details » · « in the admin add
driver, give the option to add the driver from a registered or non-registered email (send an
invitation by email) ».

The client, 19 Nov 2026 (2.94.0): « driver registration requests are separated into two categories
using a radio button: private (non-professional) and professional. For non-professionals, there is
a one-page registration form » · « non-professionals can be immediately authorized » · « Admin:
need a field to select this type of driver and to receive an email alert » · « when inscription is
done, it would be great to send a congratulatory message » · « need to cancel format of field for
professional shipper register ». The owner's ruling: **« private » is the existing in-house kind**
(`carriers.kind = 'private'`, role `driver`); « professional » is the outside carrier. No third
kind, no migration.

## 1. Vocabulary

| Word | Role | `carriers.kind` | Application | Sees money / bids |
|---|---|---|---|---|
| Particulier (interne) / Private (in-house) | `driver` | `private` | short | no |
| Professionnel / Professional | `carrier` | `professional` | full (company, registration number, documents) | yes |

**One vocabulary, one helper**: `carrierKindLabel(kind, locale)` in `src/lib/carrier-kind.ts`. The
admin table's Type column and filter, the file, the file editor, the applicant's summary, the admin
notification and the alert mail all read it — it is in `src/lib` and not in `messages/*.json`
because the mail is rendered on the server with no locale. `CARRIER_KINDS` there is asserted against
`carrierKindEnum`. The applicant's own form spells the two out — « Particulier — chauffeur interne
Expeditop », « Professionnel — transporteur » — and that copy is in `messages`.

The **role** labels are a different thing and did not move: `driver` still reads « Chauffeur
interne », `carrier` « Transporteur » (§5).

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
| `professional` | companyName, siret (a SIRET or a foreign company number, §8), vat, legalForm, phone, address, city, postal, bio | as sent, identifiers normalised (§8) |
| `private` | contactPhone, addressLine, city, postalCode, bio | `companyName = "Expeditoo"`, `siret = null` |

- `kind` cannot change once the file is `approved` or `suspended`: `KIND_LOCKED` 409. A draft,
  rejected or deregistered file may switch; a `submitted` or `under_review` one is refused whole
  for the applicant (`APPLICATION_LOCKED`) and may still be switched by staff (§7).
- An in-house file has no required documents and no banking; submitting never emails « documents
  missing ».
- **The form asks the kind first, as a radio** (`KindChoice` in `CarrierProfileForm`): two cards,
  each with one line saying what it involves — « Particulier — chauffeur interne Expeditop » (short
  form: phone, address; no company, no documents, no banking; Expeditop assigns your runs) and
  « Professionnel — transporteur » (company, registration number, documents, banking; you make
  offers). Professional is the default, which is the server's. It replaced a tick, « Je suis
  chauffeur interne », which read as an exception to a default. Choosing « particulier » swaps the
  company fields for the short set and hides the document and banking cards.
- Once the kind is locked (`approved`, `suspended`) the two cards are shown read-only with the
  sentence « Le type ne peut plus changer une fois le dossier approuvé… ». The applicant's screen
  shows the summary rather than the form in those states, so this is the form's own guard for
  whoever renders it there; the server's `KIND_LOCKED` is unchanged.
- `DriverOnboardingDialog` used to advertise « trois étapes » and list documents. The screen is one
  page, and an in-house driver is asked for no document: it now presents the two kinds and says a
  person validates the file.

### 3.1 Approval is not automatic — decided, and why

The client asked that non-professionals be « immediately authorized ». **They are not, on
purpose.** An approved driver reads requests at the `vetted` audience — street addresses and exact
pins (`listing_privacy_spec.md`, CLAUDE.md gotcha 16). « Particulier » is a radio any signed-in
account can pick, so approving on it would hand every requester's address to whoever ticked it. The
status flow is unchanged: `draft → submitted → approved` by an admin or operator.

The immediate lane the client wants already exists, on the side that knows the person: **admin
« add driver »** (§4) creates an *approved* in-house file in one step, and « Gérer le rôle » (§5)
does the same for an existing account.

What changed instead is that the wait is visible and short:

- The applicant is told plainly. `ApplicationStatusBanner` reads `banner.inHouse.*` for a `private`
  file — submitted: « Expeditop valide chaque chauffeur interne à la main… Vous recevrez un e-mail
  dès que votre dossier est validé »; approved: « Expeditop vous attribue vos courses », with no
  word about offers. The checklist above the submit button says the same before they press it
  (`checklist.inHouseTitle` / `inHouseDescription`).
- The admin is told at once, with the type first. `alertAdminsOfApplication` sends every admin a
  notification titled « Nouveau dossier chauffeur — Particulier (interne) » (or « — Professionnel »)
  and a mail whose **subject** is « Nouveau dossier chauffeur — Particulier (interne) : {name} ».
- Both link **to the file, not the list**: `/admin/drivers?tab=applications&file=<carrierId>`
  (`appUrl()` for the mail). `CarrierApplicationsList` reads `file` and opens that application's
  detail once it has loaded — once per id, so closing the dialog does not reopen it. An id that is
  not in the list opens nothing.

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
- UI: « Compléter le dossier » in the application detail opens `CarrierFileEditor` (kind radio —
  the same two labels —, contact and company fields, add a vehicle). The detail says when the file is incomplete (no phone
  or no vehicle) — which is what a file created by « Gérer le rôle » looks like.

## 8. Formats: a professional registered outside France

The client, 19 Nov: « need to cancel format of field for professional shipper register ». The app
takes jobs in several countries (`JOB_COUNTRIES`), and the professional form refused anyone without
a 14-digit SIRET, a `+33` phone, a 5-digit postal code, an `FR…` VAT number and an `AA-123-AA`
plate. The rules below are in `src/lib/french-identifiers.ts` and nowhere else: the DTO
(`carrier.dto.ts`) and the forms (`CarrierProfileForm`, `VehicleForm`) call the same functions.

| Field | Accepted | Stored | Code |
|---|---|---|---|
| Company number (`siret`) | 5–20 letters/digits once spaces, dots and dashes are stripped. Fourteen digits is a SIRET | stripped, upper case (`normalizeCompanyNumber`) | `INVALID_SIRET` |
| Phone (`contactPhone`) | a French number as before (`0X…`, `+33X…`) **or** `+` and 8–15 digits. A `+33` number must be a French one | as sent; the application form sends a French number as « +33 6 12 34 56 78 » and any other as `+digits` (`normalizeContactPhone`) | `INVALID_PHONE` |
| Postal code | 3–10 letters/digits, single spaces or dashes between (`CONTACT_POSTAL_CODE_PATTERN`) | trimmed | `INVALID_POSTAL_CODE` |
| VAT (`vatNumber`, optional) | two letters + 2–13 letters/digits | no spaces or dots, upper case (`normalizeVat`) | `INVALID_VAT` |
| Plate | the French format **or** 4–12 letters/digits, single spaces or dashes between | upper case | `INVALID_PLATE` |
| IBAN / BIC | unchanged — mod-97 was already international; a French IBAN must be 27 characters | last 4 only | `INVALID_IBAN` / `INVALID_BIC` |

- The label is « SIRET ou numéro d'entreprise ». The field takes letters, never reshapes what is
  being typed, and regroups a SIRET 3-3-3-5 on blur (`formatCompanyNumber`). The column, the error
  code and `SIRET_ALREADY_REGISTERED` keep the French name; the uniqueness check is unchanged and
  compares the normalised value, so « BE 0123.456.789 » and « be0123456789 » are one company.
- The phone is a free field. Its fixed « 🇫🇷 +33 » prefix is gone.
- The postal rule is **not** `JOB_POSTAL_CODE_PATTERN` (4–6 digits): that one drops letters, and a
  carrier's file has no country column to pick a stricter format from. Nothing downstream reads a
  carrier's postal code as a French département.
- Both kinds share the phone and postal rules (`contactFields`), so the in-house form and the admin
  « add driver » body (`createDriverSchema`) are relaxed with it.
- **Unchanged, deliberately**: `POSTAL_CODE_PATTERN` (5 digits) is still the rule for a declared
  trajet (`carrier-routes.dto.ts`); `isValidSiret`, `isValidFrenchPhone` and `PLATE_PATTERN` are
  still exported and still French.
- Every column involved is `text`, so no rule had to be capped to a column and there is no
  migration.
- Texts to a driver already handle this: `toE164Fr` passes any `+` number of 8–15 digits through.

## 9. Congratulation on approval

`approve` sent one English in-app notification. Approving — and `grantRole` when it is what approves
the file — now calls `congratulateOnApproval(userId, kind)`:

| Kind | Notification | Mail button |
|---|---|---|
| `private` | « Félicitations, vous êtes chauffeur Expeditop » — Expeditop assigns your runs, find them under « Livraisons » | `/driver/shipments` |
| `professional` | « Félicitations, votre dossier est approuvé » — read the missions and make your offers | `/expedion` |

- The mail is `DriverApprovedEmail` (French, `emailService.sendDriverApprovedEmail`), sent to the
  account's address after the transaction commits.
- **A mail never fails an approval**: the account lookup and the send are in their own `try`; the
  notification already swallowed its own failure. A failure is logged and the approved row returned.
- A repeat `approve` on an already-approved file is the role backfill and says nothing, as before.
  `grantRole` on an already-approved file says nothing either.
- `reinstate` was silent and stays silent. `createInHouseDriver` sends its invitation, not this.
- The other decisions were English and are French: « Dossier chauffeur refusé », « Compte chauffeur
  suspendu », « Compte marqué absent », « Compte chauffeur désinscrit ». The document-expiry notice
  from the daily cron is still English.

## Test coverage required

`carrier.service` (grant by kind, KIND_LOCKED, `grantRole` in its four cases, the two admin modes
and their refusals, `adminUpdateApplication`, `adminAddVehicle`), `user.service` (assignRole
delegates to the carrier service, several-role filter), `role-groups`, `primary-role`, the
application form (tick swaps fields, what is sent), the admin dialog (mode toggle, no company
fields), the role dialog (both roles offered), `JobBidSection` (in-house note), `takeJob`
(refused), the DTOs, the invitation link and mail, the migrations journal.

2.94.0: the identifier rules, each accept and reject (`french-identifiers.test.ts`); the DTO with
foreign formats and its error codes (`carrier-kinds.test.ts`); the label helper against the enum
(`carrier-kind.test.ts`); the form's radio for both kinds, the locked state, what is sent, a foreign
carrier (`CarrierProfileForm.test.tsx`); the dialog's two kinds; the in-house banner; the admin
labels, the `?file=` link and the editor's radio (`CarrierKind.test.tsx`); approval sends the mail by
kind and survives its failure, the alert's type and link (`carrier-approval.service.test.ts`); both
mails and their subjects by kind (`driver-emails.test.tsx`).
