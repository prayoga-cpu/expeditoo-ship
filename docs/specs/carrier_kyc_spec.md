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

vehicle_type = 'motorcycle' | 'car' | 'van' | 'truck_3_5t' | 'truck_7_5t'
             | 'truck_19t' | 'semi_trailer' | 'flatbed' | 'refrigerated'
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

`POST /api/carrier/application/submit` validates that **all** of the following hold,
returning `400 INCOMPLETE_APPLICATION` with a `missing: string[]` listing every gap
at once — never one error at a time:

| Requirement | Rule |
|---|---|
| `companyName` | 2–200 chars |
| `siret` | Exactly 14 digits, **Luhn-valid** → else `400 INVALID_SIRET` |
| `vatNumber` | If present, `/^FR[0-9A-Z]{2}\d{9}$/` |
| `contactPhone` | Valid French number (`+33` or `0` + 9 digits) |
| `postalCode` | `/^\d{5}$/` |
| Documents | `cni_recto`, `cni_verso`, `driving_licence`, `kbis`, `insurance_certificate`, `rib` all uploaded |
| IBAN | Valid French IBAN, **mod-97 checksum** → else `400 INVALID_IBAN` |
| BIC | `/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/` |
| Vehicles | ≥ 1 vehicle with `maxWeightKg > 0` and a plate matching `/^[A-Z]{2}-\d{3}-[A-Z]{2}$/` |

`transport_licence` is required only when any vehicle is `truck_7_5t` or heavier
(French regulation) → else `400 TRANSPORT_LICENCE_REQUIRED`.

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
| `POST` | `/api/carrier/application/submit` | owner | `draft` → `submitted`, §3 gate |
| `POST` | `/api/carrier/application/withdraw` | owner | `submitted` → `draft` |
| `GET` | `/api/carrier/application` | owner | Own application + document status |
| `POST` | `/api/carrier/documents` | owner | Upload one document |
| `GET` | `/api/carrier/documents/:id` | owner or admin | Presigned 5-min URL |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/carrier/vehicles[/:id]` | approved carrier | Fleet management |
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
| 4 | Application submitted with an expired document | `400 DOCUMENT_ALREADY_EXPIRED` |
| 5 | User already holds the `carrier` role but has no `carriers` row | Treated as not approved; `CARRIER_NOT_APPROVED` |
| 6 | Two admins approve concurrently | Idempotent (§6); the second is a no-op |
| 7 | Carrier suspended with money in flight | Existing shipments complete and pay out normally |

---

## 9. Test coverage required

`src/server/services/__tests__/carrier.service.test.ts`:

- SIRET Luhn validation and IBAN mod-97, both valid and invalid vectors.
- `INCOMPLETE_APPLICATION` reports **all** gaps at once, not the first.
- The full §2 state machine, including every illegal transition.
- Approval grants the role and is idempotent (edge case 6).
- Documents are never returned as a public URL (§4.2) — assert the presigned path.
- The full IBAN never appears in any DB row or API response (§4.3).
- Auto-suspension on required-document expiry (§7).
