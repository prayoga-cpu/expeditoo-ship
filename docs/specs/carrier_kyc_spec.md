# Spec — Carrier KYC & Onboarding

**Roadmap ref:** `ROADMAP.md` §8 Phase A "Carrier KYC — CNI, licence, vehicle, IBAN/BIC, RIB, admin approval"
**Plan:** `docs/plans/plan_phase_a_bidding_core.md` WP4

No carrier bids on a job until an admin has approved their file. Approval is
**manual** in Phase A — no KYC vendor is integrated (`ROADMAP.md` §10 open
decision 4 is unresolved, so this spec assumes manual review and is written so a
vendor can slot in later without reshaping the schema).

---

## 1. Entities

```ts
carriers {
  id                text pk
  userId            text unique not null -> user.id
  companyName       text not null
  siret             text not null unique        // 14 digits
  vatNumber         text                        // FR + 11 chars, optional
  legalForm         text                        // SARL, SAS, EI, auto-entrepreneur…
  contactPhone      text not null
  addressLine       text not null
  city, postalCode  text not null
  status            carrier_status not null default 'draft'
  ibanLast4         text                        // display only
  bicLast4          text                        // display only
  stripeAccountId   text                        // Connect account, Phase C payouts
  approvedAt        timestamp
  approvedBy        text -> user.id
  rejectionReason   text
  averageRating     double precision default 0
  completedJobs     integer default 0
  createdAt, updatedAt
}

carrier_status = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'suspended'

carrier_documents {
  id            text pk
  carrierId     text not null -> carriers.id on delete cascade
  kind          carrier_document_kind not null
  objectKey     text not null      // R2 key, PRIVATE bucket prefix
  mimeType      text not null
  sizeBytes     integer not null
  expiresAt     timestamp          // for licence / insurance
  status        'pending' | 'accepted' | 'rejected'
  rejectionReason text
  uploadedAt    timestamp not null
}

carrier_document_kind =
  'cni_recto' | 'cni_verso' | 'driving_licence' | 'kbis'
| 'insurance_certificate' | 'transport_licence' | 'rib'

vehicles {
  id            text pk
  carrierId     text not null -> carriers.id on delete cascade
  type          vehicle_type not null
  make, model   text
  year          integer
  plateNumber   text not null      // unique per carrier
  maxWeightKg   numeric not null
  maxLengthCm, maxWidthCm, maxHeightCm  numeric
  features      jsonb default '[]'  // 'refrigerated', 'tail_lift', 'fragile_friendly'…
  isActive      boolean default true
  createdAt, updatedAt
}

vehicle_type = 'little_car' | 'berline' | 'break' | 'van' | 'truck_20m3'
             | 'truck' | 'hayon_tailgate'
```

This replaces `transporter_profiles`, whose JSONB `vehicle` column allowed only one
vehicle per transporter — insufficient, since offers reference a specific vehicle
(`offers_engine_spec.md` §3) and a carrier runs a fleet.

---

## 2. Onboarding flow

```
draft ──submit──► submitted ──admin opens──► under_review
                                               ├──approve──► approved
                                               └──reject───► rejected ──resubmit──► submitted
                                                                approved ──admin──► suspended
                                                                suspended ──admin──► approved
```

- `draft` — the carrier is filling the form. Freely editable.
- `submitted` — locked for review. The carrier cannot edit; they may withdraw to `draft`.
- `approved` — the `carrier` role is granted (`roles_spec.md` §2) and bidding unlocks.
- `rejected` — `rejectionReason` is mandatory and is shown to the carrier. Resubmission allowed.
- `suspended` — bidding blocked, existing shipments continue (`roles_spec.md` edge case 4).

---

## 3. Submission requirements

**Applying is deliberately thin.** `POST /api/carrier/application/submit` gates on
nothing beyond having a carrier row — no document, no banking detail, no vehicle.
The only requirements are the profile fields `POST /api/carrier/application`
(create/update the `draft`) already enforces before a row can exist at all, so
there is nothing left for `/submit` itself to check:

| Requirement | Rule |
|---|---|
| `companyName` | 2–200 chars |
| `siret` | Exactly 14 digits → else `400 INVALID_SIRET` (format only, no checksum — a real registry lookup is the admin reviewer's job at approval, and a Luhn check rejected well-formed numbers along with genuine typos) |
| `vatNumber` | If present, `/^FR[0-9A-Z]{2}\d{9}$/` |
| `contactPhone` | Valid French number (`+33` or `0` + 9 digits) |
| `addressLine`, `city` | Non-empty |
| `postalCode` | `/^\d{5}$/` |

Documents, banking and vehicles are **optional at submission**. Vehicles
(`/carrier/fleet`) have no status gate at all and can be added any time. Profile
fields and documents/banking follow the state machine in §2: open while `draft`,
locked while `submitted`/`under_review`, open again once review ends —
`approved` or `rejected` — since §6 approval does not require them either. Each
item stays validated on its own endpoint when supplied:

| Item | Rule, enforced when the item is uploaded/saved |
|---|---|
| Documents | `cni_recto`, `cni_verso`, `driving_licence`, `insurance_certificate`, `rib` are the kinds `REQUIRED_DOCUMENT_KINDS` (`carrier-constants.ts`) calls "required" — a label the review UI and the document-expiry cron (§7) use, not a submission gate |
| IBAN | Valid French IBAN, **mod-97 checksum** → else `400 INVALID_IBAN` |
| BIC | `/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/` |
| Vehicles | `maxWeightKg > 0` and a plate matching `/^[A-Z]{2}-\d{3}-[A-Z]{2}$/` |

`transport_licence` is the document French regulation requires once a vehicle's
`maxWeightKg` crosses 7.5 t, but nothing in the system enforces it — adding a
heavy vehicle does not check for one, and neither does submission or approval
now that both skip the completeness gate entirely. (`vehicle_type` — see §1 —
is a body-style choice, not a weight class, so it was never the right signal
for this check even before `0031_vehicle_type_taxonomy.sql` collapsed the old
weight-tiered truck values into one generic `truck`.) It is a reviewer
judgment call at approval, same as the SIRET registry lookup above. A carrier
with no vehicle at all cannot bid regardless — an offer names the vehicle
that will do the job (`offers_engine_spec.md` §3) — so an empty fleet gates
bidding on its own without any application-status check.

The product intent: a driver should be able to apply in minutes with just their
company and contact details, get approved by an admin on that alone, and fill in
documents, banking and their vehicle afterward at their own pace.

---

## 4. Document handling — security

KYC documents are identity documents. They are **not** public assets.

1. Uploaded to R2 under a **private** prefix (`kyc/{carrierId}/…`), never the public
   listing-photo bucket path.
2. Never served by direct URL. Reads go through
   `GET /api/carrier/documents/:id` which authorises (`admin`, or the owning carrier)
   and returns a **presigned URL valid for 5 minutes**.
3. The full IBAN and BIC are **never** stored in the application database. Only
   `ibanLast4` / `bicLast4` are persisted for display; the full value goes straight
   to Stripe. This keeps the deployment out of scope for storing raw bank
   credentials.
4. Accepted: `application/pdf`, `image/jpeg`, `image/png`. Max 10 MB.
   Anything else → `400 UNSUPPORTED_DOCUMENT_TYPE`.
5. Document rows are never hard-deleted while the carrier is `approved` — they are
   the audit trail for the approval.

---

## 5. Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/carrier/application` | authenticated | Create or update the `draft` |
| `POST` | `/api/carrier/application/submit` | owner | `draft`/`rejected` → `submitted` (§3) |
| `POST` | `/api/carrier/application/withdraw` | owner | `submitted` → `draft` |
| `GET` | `/api/carrier/application` | owner | Own application + document status |
| `POST` | `/api/carrier/documents` | owner | Upload one document |
| `GET` | `/api/carrier/documents/:id` | owner or admin | Presigned 5-min URL |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/carrier/vehicles[/:id]` | owner, any status | Fleet management — no approval gate; a carrier can register a vehicle while still `draft` (§3) |
| `GET` | `/api/admin/carrier-applications` | admin | Review queue, filter by status |
| `POST` | `/api/admin/carrier-applications/:id/approve` | admin | §6 |
| `POST` | `/api/admin/carrier-applications/:id/reject` | admin | Requires `reason` |
| `POST` | `/api/admin/carriers/:id/suspend` | admin | Requires `reason` |

The existing `/api/admin/driver-applications/*` routes are re-pointed here rather
than duplicated.

---

## 6. Approval

Transactional:

1. `carrier.status = 'approved'`, `approvedAt`, `approvedBy` set.
2. Grant the `carrier` role in `user_roles`.
3. Mark every document `accepted`.
4. Create the Stripe Connect **Express** account, store `stripeAccountId`
   (onboarding link emailed; payouts themselves are Phase C).
5. Email the carrier via Resend, and notify in-app.

Rejection sets `rejected` + `rejectionReason`, grants no role, and emails the reason.
Approving an already-`approved` carrier is a no-op returning `200` — idempotent.

**Approval does not require a complete file.** It has no gate on documents,
banking or a vehicle — an admin can approve a `submitted` application on the
company and contact details alone and let the carrier add the rest afterward
(§3, edge case 8). Step 3 above marks whatever documents exist as `accepted`;
zero documents is not an error.

---

## 7. Document expiry

`driving_licence`, `insurance_certificate` and `transport_licence` carry `expiresAt`.

A daily cron (`docs/specs/cron_spec.md`):

- 30 days before expiry — remind the carrier by email.
- On expiry — the document goes `pending`; if it is a **required** document the
  carrier is `suspended` automatically, with the reason
  `"Document expired: {kind}"`. Live offers expire; active shipments continue.

---

## 8. Edge cases

| # | Case | Behaviour |
|---|---|---|
| 1 | SIRET already registered to another carrier | `409 SIRET_ALREADY_REGISTERED` |
| 2 | Carrier edits company details after approval | `companyName`/address editable; `siret` and IBAN require re-review → status back to `under_review`, bidding paused |
| 3 | Vehicle deleted while referenced by a live offer | Blocked — `ON DELETE RESTRICT` (`offers_engine_spec.md` edge case 5). Deactivate (`isActive = false`) instead |
| 4 | Document uploaded with an expiry date already in the past | `400 DOCUMENT_ALREADY_EXPIRED`, at upload time — `/submit` no longer inspects documents at all (§3) |
| 5 | User already holds the `carrier` role but has no `carriers` row | Treated as not approved; `CARRIER_NOT_APPROVED` |
| 6 | Two admins approve concurrently | Idempotent (§6); the second is a no-op |
| 7 | Carrier suspended with money in flight | Existing shipments complete and pay out normally |
| 8 | Admin approves an application with no documents, banking or vehicle | Allowed — `approve` (§6) does not gate on completeness. The carrier is approved and adds the rest afterward, but cannot actually bid until a vehicle exists (§3) |

---

## 9. Test coverage required

`src/server/services/__tests__/carrier.service.test.ts`:

- SIRET's 14-digit format check and IBAN mod-97, both valid and invalid vectors.
- `submitApplication` succeeds with no documents, banking or vehicle on file
  (§3) — and still refuses a second submission or a suspended carrier.
- The full §2 state machine, including every illegal transition.
- Approval grants the role and is idempotent (edge case 6), and succeeds on an
  incomplete file (edge case 8).
- Documents are never returned as a public URL (§4.2) — assert the presigned path.
- The full IBAN never appears in any DB row or API response (§4.3).
- Auto-suspension on required-document expiry (§7).
