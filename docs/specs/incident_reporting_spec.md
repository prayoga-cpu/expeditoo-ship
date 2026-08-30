# Incident Reporting Specification

Both parties to a running job need one button for "something has gone wrong".
Today they have none: the client can cancel (and only before pickup), the
transporter can move a status, and everything in between — a damaged pallet, a
locked gate, a lorry that will not start — has nowhere to go but a phone call
nobody logs.

This spec adds a **shipment incident**: a first-class, auditable report that
either side can file at any point in a run, routed to the operators who can act
on it.

---

## 1. What an incident is, and is not

An incident is **a report, not a lever**.

- It **does not** change `shipments.status`.
- It **does not** touch `payments`: nothing is captured, held, released or
  refunded because an incident exists. `settleDelivery` is not modified.
- It **does not** block a status transition, a delivery or a payout.

It records what happened, who says so, and when — and it puts that in front of
an operator. Everything money-shaped stays a human decision made elsewhere,
which is the only defensible position while the commission split is still
undecided (`ROADMAP.md` §10) and payments run under `MOCK_PAYMENTS`.

**Why no coupling.** An incident is one party's assertion. Letting an assertion
gate a capture would hand either side a unilateral freeze on the other's money,
with no adjudication step in between. The operator queue *is* the adjudication
step; until an operator has looked, nothing should move on the strength of a
claim alone.

---

## 2. Who may report

Authorisation is `partyFor()` from `src/server/services/shipment-access.ts` —
the same predicate the photos and status services use. There is no new access
model.

| `Party` | May report | Meaning here |
|---|---|---|
| `shipper` | ✅ | **the client** — owner of the listing |
| `carrier` | ✅ | **the transporter** — the account that won the job |
| `driver` | ✅ | the transporter's employee actually on the run |
| `staff` | ✅ | an operator/admin filing on a client's behalf |
| `none` | ❌ | `FORBIDDEN` (403) |

This is precisely the requirement — "both the client and the transporter" — and
it falls out of the existing predicate without a new one.

**Out of scope this iteration:** an Expedion-escalated client. Those people have
no `user` row in this repo (they are quote owners keyed by
`expedion_quotes.firebase_uid`), so `partyFor()` cannot resolve them and the
listing is owned by the system account. An operator files for them from
`/admin/shipments`, which is why `staff` may report. Giving them a direct route
means a signed-link or Expedion-authenticated endpoint, in the shape
`shipment_confirmations` already uses for its one-tap link — a separate piece of
work.

### 2.1 Reporting window

Any status **except** a run that is already finished:

- Allowed: `PENDING`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`
- Refused: `DELIVERED`, `CANCELLED` → `INCIDENT_RUN_CLOSED` (409)

A delivered run's disputes are a billing matter, not a live operational one, and
they belong in support rather than in an operational queue that operators are
meant to be able to empty.

---

## 3. Data model

### 3.1 Enums

Three new `pgEnum`s in `src/db/schema/shipments.ts`.

```ts
shipment_incident_category: damage | delay | access | vehicle | cargo_mismatch | safety | other
shipment_incident_severity: low | medium | high
shipment_incident_status:   OPEN | ACKNOWLEDGED | RESOLVED
```

The **reporter's role is not a new enum** — it reuses `actorRoleEnum`, already
on `shipment_events`. A restated copy is how the role enum broke admin role
assignment once already (CLAUDE.md §Gotchas 8).

`severity` is **informational**. It sorts the queue; it gates nothing. There is
deliberately no `BLOCKING` value, because a value that reads as blocking in a
system that blocks nothing is a lie told to whoever reads it next.

### 3.2 `shipment_incidents`

| Column | Type | Notes |
|---|---|---|
| `id` | text pk | `nanoid()` |
| `shipment_id` | text NOT NULL → `shipments` cascade | |
| `category` | enum NOT NULL | |
| `severity` | enum NOT NULL default `medium` | |
| `status` | enum NOT NULL default `OPEN` | |
| `description` | text NOT NULL | 10–2000 chars |
| `photo_urls` | jsonb | `string[]`, public URLs from `/api/upload`; `[]` when none |
| `reported_by_user_id` | text → `user` set null | survives account deletion |
| `reported_by_role` | `actor_role` NOT NULL | who they were *at the time* |
| `conversation_id` | text → `conversations` set null | the linked support thread |
| `acknowledged_at` / `acknowledged_by_user_id` | timestamp / text | |
| `resolved_at` / `resolved_by_user_id` | timestamp / text | |
| `resolution_note` | text | required to resolve |
| `created_at` / `updated_at` | timestamp | |

Indexes: `(shipment_id)`, `(status)`, `(status, created_at)` for the queue.

`reported_by_role` is stored rather than recomputed because roles change. An
incident filed by someone who was the driver must still read as filed by the
driver after they are moved off the run.

### 3.3 Photos

Reuses the existing public image path — `POST /api/upload`, session-gated,
Sharp-compressed, R2 — and stores the returned URLs. Max **6**, matching
`MAX_PER_STAGE` in the photos service.

**These are deliberately public URLs, not `shipment_photos` object keys.**
`shipment_photos` is *evidence*: it requires a live geolocation fix, forbids
updates and is served only through an authorising redirect. An incident photo is
*illustration* — "here is the dented crate" — attached to a description a human
will read. Holding it to the evidence standard would mean refusing a report from
a driver whose GPS is off inside a warehouse, which is exactly when incidents get
filed. The tradeoff is recorded here rather than hidden: an incident photo URL is
guessable-resistant but not authorised, the same standing as a listing photo.

---

## 4. Side effects of a report

Three, all additive, in this order. **None of them may fail the report.**

1. **A `shipment_events` row.** `status` = the run's *current* status
   (unchanged), `previousStatus` = null, `actorRole` = the reporter's role,
   `note` = the description truncated, `metadata` =
   `{"incidentId":"…","category":"…","severity":"…"}`. The timeline is already
   rendered on both parties' screens, so the incident shows up on both without a
   second surface.

2. **A support thread.** `messagesService.getOrCreateSupportConversation(reporterId)`
   — the reporter's single persistent support conversation, not a new one per
   incident, because that is the existing model (`support_chat_spec.md`: "one
   per user"). A first message is posted **authored by the reporter**
   (`messages.sender_id` is NOT NULL, and inventing a system user for this is
   not worth a migration). The conversation id is stored on the incident.

   Skipped when the reporter is `staff`: an operator filing on a client's behalf
   should not open a support thread with themselves.

3. **Operator notification.** `getUsersByRole("operator")` ∪
   `getUsersByRole("admin")`, deduplicated, one `notificationsService.createNotification`
   each, `type: "incident_reported"`, `linkUrl: /admin/incidents`.

   There is **no existing fan-out-to-a-role helper**; this is the first caller
   that needs one, so it lives in the incidents service rather than being
   invented as shared infrastructure for one use (YAGNI, `docs/rules.md` §0.3).

**Failure isolation.** The incident row is written first and committed. Each of
the three follow-ups runs in its own `try`/`catch` and logs on failure. A
notification outage must not lose a driver's report — the same reasoning that put
`invoicesService.createFromPayment` in its own try inside `settleDelivery`.

---

## 5. API

| Method | Path | Who | Purpose |
|---|---|---|---|
| `POST` | `/api/shipments/:id/incidents` | any party | file one |
| `GET` | `/api/shipments/:id/incidents` | any party | this run's incidents |
| `GET` | `/api/admin/incidents` | staff | the queue |
| `PATCH` | `/api/admin/incidents/:incidentId` | staff | acknowledge / resolve |

Routes follow `cancel/route.ts` exactly: `resolveViewer()` → `unauthorised()` →
zod-parse the body → call the service → `ok(...)`, with `handleError` translating
the thrown `ShipmentError`.

### 5.1 Error codes

| Code | Status | When |
|---|---|---|
| `SHIPMENT_NOT_FOUND` | 404 | no such shipment |
| `FORBIDDEN` | 403 | `partyFor()` returned `none`, or a non-staff caller hit an admin route |
| `INCIDENT_RUN_CLOSED` | 409 | run is `DELIVERED` or `CANCELLED` |
| `INCIDENT_NOT_FOUND` | 404 | no such incident |
| `INCIDENT_ALREADY_RESOLVED` | 409 | transition out of `RESOLVED` |
| `INCIDENT_RESOLUTION_REQUIRED` | 400 | resolving with no note |

### 5.2 Status transitions (staff only)

```
OPEN ──────► ACKNOWLEDGED ──────► RESOLVED
  └──────────────────────────────────▲
```

`OPEN → RESOLVED` is allowed (a trivial report needs no ceremony).
`RESOLVED` is terminal — reopening files a new incident, so the history of what
was decided and when stays append-only.

---

## 6. UI

### 6.1 The button, both sides

One shared component, `ReportIncidentDialog`, in `src/features/app/incidents/ui/`,
mounted on both surfaces. It mirrors the existing `CancelDialog` in
`DeliveryDetail.tsx` — `Dialog` + `DialogTrigger` + `Textarea` + `DialogFooter`,
disabled submit until valid — so it needs no new interaction vocabulary.

Fields: category (select), severity (select, default `medium`), description
(textarea, ≥10 chars), photos (optional, ≤6).

| Surface | File | Placement |
|---|---|---|
| **Client** | `src/features/app/deliveries/ui/DeliveryDetail.tsx` | header, beside `CancelDialog` |
| **Transporter** | `src/features/app/driver/ui/ShipmentActions.tsx` | below the status actions |

Trigger styling is `variant="outline"` with `AlertTriangle`, **not**
`destructive`. Cancelling is destructive; reporting a problem is not, and a red
button next to a red button teaches people to avoid both.

The button is hidden when the run is `DELIVERED`/`CANCELLED`, matching §2.1 —
the server still enforces it.

### 6.2 Where reported incidents show

A section on both detail screens listing this run's incidents: category badge,
severity, status badge, relative time, description, photo thumbnails. Light and
dark are both mandatory.

### 6.3 Operator queue

`/admin/incidents`, filtered by status (default `OPEN`), sorted severity then
age. Row → shipment link, reporter + role, category, description, photos, and
the acknowledge/resolve actions. Empty state through `centered-empty-state.tsx`.
Registered in the admin sidebar; gated on `isAdmin || isOperator` at both the
page and the API.

---

## 7. i18n

New `incidents` namespace in **both** `messages/en.json` and `messages/fr.json`,
at exact key parity. Covers: trigger label, dialog copy, every category and
severity and status label, validation and toast strings, the queue's columns and
empty state.

---

## 8. Test coverage required

`src/server/services/__tests__/shipment-incidents.service.test.ts`

- each of `shipper` / `carrier` / `driver` / `staff` may report; `none` → 403
- `DELIVERED` and `CANCELLED` → `INCIDENT_RUN_CLOSED`
- a `shipment_events` row is appended with the run's current status and the
  incident id in `metadata`
- the support thread is created and linked for a party reporter
- **no** support thread for a `staff` reporter
- every operator **and** admin is notified, deduplicated across both roles
- a throwing notifier / message post still returns a created incident
- photo count > 6 rejected
- transitions: `OPEN→ACKNOWLEDGED`, `OPEN→RESOLVED`, `ACKNOWLEDGED→RESOLVED`;
  out of `RESOLVED` → 409; resolve without a note → 400
- a non-staff viewer calling a status change → 403
- **the shipment's status and any payment row are untouched by a report**

`src/features/app/incidents/ui/__tests__/ReportIncidentDialog.test.tsx`

- submit disabled until the description reaches 10 chars
- category and severity reach the mutation
- the dialog closes on success and the error toast shows on failure

Target ≈ 30 tests, comparable to recent slices (withdrawals 25, carrier trips 44).
