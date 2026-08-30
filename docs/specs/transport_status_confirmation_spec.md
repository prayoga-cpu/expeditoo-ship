# Specification: Transport status confirmation

**Plan:** `docs/plans/plan_transport_status_confirmation.md`
**Related:** `docs/specs/shipment_spec.md`, `docs/specs/shipment_events_spec.md`
**Date:** 2026-08-29

---

## 1. Overview

A shipment's status is moved by the transporter and **attested** by the client.
The two are different facts and are stored separately:

| Fact | Where it lives | Who writes it |
|---|---|---|
| The run reached a stage | `shipments.status` + `shipment_events` | carrier, driver, staff |
| The client agrees it happened | `shipment_confirmations` | the client, through one of two channels |

**A client attestation moves nothing.** It cannot advance a status, capture a
payment, close a listing, release a hold or create an event. It records that a
named party said "yes, this happened", and nothing else. Every other rule in
this spec follows from that one, including why a public unauthenticated link is
acceptable in §6.

## 2. User stories

- As a driver, I confirm the retrait and the client is asked to confirm it too,
  so a dispute has two signatures rather than mine alone.
- As an Expedion client, I open the app, see *En cours de livraison*, and
  confirm reception when the lot arrives.
- As an Expedion client who never opens the app, I tap the link in the SMS and
  confirm in one screen with no account.
- As an operator, I look at a run and see which milestones the client has
  acknowledged and which are still waiting.

## 3. Status vocabulary

The six database states are unchanged. Only the strings change.

| State | FR (`deliveries.shipmentStatus`, `driver.status`) | EN |
|---|---|---|
| `PENDING` | En attente | Pending |
| `ASSIGNED` | **En préparation** | **Preparing** |
| `PICKED_UP` | **En retrait** | **At pickup** |
| `IN_TRANSIT` | **En cours de livraison** | **Out for delivery** |
| `DELIVERED` | Livrée | Delivered |
| `CANCELLED` | Annulée | Cancelled |

`Livrée` and `Annulée` keep their feminine agreement: on both surfaces the
subject is *la livraison*. The three new strings are gender-neutral and are
used verbatim as given.

Timeline event names (`deliveries.events.*`) are past-tense descriptions of the
moment, not status labels, and change only where they contradict the new
vocabulary:

| State | FR before | FR after |
|---|---|---|
| `ASSIGNED` | Chauffeur assigné | Chauffeur assigné *(unchanged)* |
| `PICKED_UP` | Colis récupéré | **Retrait effectué** |
| `IN_TRANSIT` | En transit | **Livraison en cours** |

## 4. Attestable milestones

Exactly two: **`PICKED_UP`** and **`DELIVERED`**. These are the moments goods
change hands. `ASSIGNED` and `IN_TRANSIT` are internal to the carrier and the
client witnesses neither, so asking for a signature on them would manufacture a
row that is permanently pending.

A milestone may be attested only once the shipment has **reached or passed** it:

| Shipment status | `PICKED_UP` attestable | `DELIVERED` attestable |
|---|---|---|
| `PENDING`, `ASSIGNED` | no — `MILESTONE_NOT_REACHED` | no |
| `PICKED_UP`, `IN_TRANSIT` | yes | no |
| `DELIVERED` | yes | yes |
| `CANCELLED` | no — `SHIPMENT_CANCELLED` | no |

`PICKED_UP` stays attestable after the run moves on, because the client is
asked at the moment of pickup and may answer a day later.

## 5. Data model

### 5.0 `shipment_confirmation_actor` (enum)

`client` | `operator`. **Who** answered, as distinct from `channel`, which is
**how**. An operator may answer for a client who cannot, and without this column
the two are indistinguishable — every surface would read *"le client a
confirmé"* for an answer the client never gave, which is the one thing a
confirmation exists to rule out.

### 5.1 `shipment_confirmation_channel` (enum)

| Value | Meaning |
|---|---|
| `expedion_app` | An authenticated Expedion caller confirmed in the Flutter app |
| `link` | A one-tap signed link from the SMS or the email was used |

### 5.2 `shipment_confirmations`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | nanoid |
| `shipment_id` | text NOT NULL → `shipments.id` cascade | |
| `milestone` | `shipment_status` NOT NULL | `PICKED_UP` \| `DELIVERED`, enforced in the service |
| `channel` | `shipment_confirmation_channel` NOT NULL | *how* they answered |
| `confirmed_by_role` | `shipment_confirmation_actor` NOT NULL default `client` | *who* answered: `client` \| `operator` |
| `confirmed_by_user_id` | text NULL → `user.id` set null | present when a real account answered |
| `confirmed_by_ref` | text NULL | the quote owner id when there is no `user` row — most Expedion clients have none |
| `note` | text NULL | free text, max 500 |
| `created_at` | timestamp NOT NULL default now | |

Indexes:

- `shipment_confirmation_unique` **UNIQUE** on (`shipment_id`, `milestone`)
- `shipment_confirmation_shipment_idx` on (`shipment_id`)

The unique index is the idempotency key. A double-tapped link, a retried SMS,
or an app tap after an email tap all resolve to the same row; the second write
is a no-op that returns the existing confirmation with `200`, never a `409`.
Making a client tap twice and see an error would be worse than a duplicate.

`confirmed_by_user_id` is nullable and `confirmed_by_ref` exists because
**most Expedion clients have no `user` row at all** — they are quote owners
keyed by `expedion_quotes.firebase_uid` (see
`admin_expedion_clients_spec.md` §2). A foreign key alone could not record who
confirmed.

## 6. The confirmation token

`src/lib/confirmation-token.ts`.

```
token = base64url(payload) + "." + base64url(HMAC-SHA256(payload, secret))
payload = JSON { s: shipmentId, m: milestone, e: expiryEpochSeconds }
```

- Secret: `BETTER_AUTH_SECRET`. **Unset ⇒ minting and verification both fail**,
  so a misconfigured deployment mails no links and honours none, rather than
  honouring everything.
- Lifetime: **30 days**. Long enough that a client who confirms a week late
  still can; short enough that a leaked SMS from last year is inert.
- Verification uses `crypto.timingSafeEqual` on equal-length buffers.
- Verification failures are indistinguishable to the caller: bad signature,
  malformed payload and expiry all return `INVALID_TOKEN` / `410`.

**Why an unauthenticated link is acceptable here.** The token is a capability
to write one row that grants nothing. Its worst case, in the hands of an
attacker, is a confirmation recorded against a milestone that has already
happened — it cannot move money, cannot move status, and cannot be replayed
into a second row because of the unique index. Stateless signing was chosen
over a stored-token table for exactly this reason: there is nothing to revoke.

## 7. Service — `shipmentConfirmationsService`

Lives in its own file rather than in `shipment.service.ts`, which is already at
its length budget. It reaches only for DALs and the SMS/email services, so
`shipment.service.ts` can import it without a cycle.

### 7.1 `attest(input)`

```ts
attest(input: {
  shipmentId: string;
  milestone: "PICKED_UP" | "DELIVERED";
  channel: "expedion_app" | "link";
  confirmedByUserId?: string | null;
  confirmedByRef?: string | null;
  note?: string;
})
```

1. Load ownership. Absent ⇒ `SHIPMENT_NOT_FOUND` / 404.
2. Status `CANCELLED` ⇒ `SHIPMENT_CANCELLED` / 409.
3. Milestone not reached per §4 ⇒ `MILESTONE_NOT_REACHED` / 409.
4. Existing row for (shipment, milestone) ⇒ return it unchanged.
5. Insert, and mirror it onto the Expedion quote timeline as an event —
   fire and forget, no status change, no-op for a listing with no quote.
   It writes through `expedionDal.addEvent` **directly, not through
   `expedionBridgeService`**: that service's only event-writing entry point is
   `writeBack`, which changes the quote's status, and a confirmation must not.
   The event echoes the quote's current status back unchanged, and names who
   answered — `actor: "client"` with *"Le client a confirmé…"*, or
   `actor: "admin"` with *"Un opérateur a confirmé… pour le compte du
   client"*.

A failed mirror is not retried: the confirmation row is the record, and the
Expedion timeline is a convenience on top of it. The `alreadyConfirmed` early
return skips the mirror, so a mirror that failed once stays missing.

### 7.2 `attestFromToken(token, note?)`

Verifies the token per §6, then delegates to `attest` with `channel: "link"`
and `confirmedByRef` taken from the linked quote's owner id.

### 7.3 `describeToken(token)`

Read-only. Returns what the landing page must render — milestone, the
shipment's current status, pickup and dropoff **cities**, and whether the
milestone is already confirmed — **without** the price, the parties'
identities, or anything the driver redaction in `shipment.service.ts`
withholds. This is a public page; treat its payload the way `redactForDriver`
treats a driver's.

Cities, never the street addresses the shipment row also holds: the link lives
for 30 days in an SMS, and the dropoff on an Expedion job is the client's home
address. They come from the listing, and are **null when the listing is
missing** rather than falling back to the address — a fallback would reinstate
exactly the leak.

`cancelled` is reported separately from `confirmable`. Both mean "no button",
but they need opposite copy: one promises a further message and the other must
not.

### 7.5 What crosses the wire

Every write path returns a **projection** — `id`, `milestone`, `channel`,
`confirmedByRole`, `createdAt`. `confirmed_by_user_id`, `confirmed_by_ref` and
`note` stay server-side: they are the audit trail, nothing that reads a write
response needs them, and one of the two write routes is unauthenticated, so a
row returned whole would hand a bearer-token holder the quote owner's id and
another client's free-text note. Projecting in the service rather than in each
route means the two cannot drift.

### 7.4 `confirmUrl(shipmentId, milestone)`

`${NEXT_PUBLIC_APP_URL}/confirm/${token}`. Returns `null` when the secret is
unset, and every caller must treat `null` as "send the message without a link"
rather than skipping the message.

## 8. Requesting an attestation

When a run reaches `PICKED_UP` or `DELIVERED`, the client is asked.

**SMS (Expedion clients).** The bridge already texts on exactly these two quote
transitions (`expedionSmsService.deliveryUpdate`, fired from
`expedionBridgeService.writeBack`). The link is appended to that existing
message rather than sent as a second SMS — two texts about one event is how a
client learns to ignore both. `writeBack` gains an optional `confirmUrl` on its
input, filled by `onShipmentStatus` from the shipment id that
`shipment.service.reportToExpedion` now passes down.

Because `onShipmentStatus` refuses to re-report a status the quote already
holds, and `IN_TRANSIT` maps onto `picked_up`, the pickup link is sent exactly
once even though two shipment transitions map to it.

**Email.** Sent to the quote's `email` on an escalated job, and to the
shipper's account email **only when there is no quote at all** — that is, on a
direct listing someone posted here. It must never fall back to the shipper on
an escalated job: that is the Expedion system account nobody logs into, so
mailing it a working one-tap token would put a live capability in an internal
mailbox and still leave the real client unasked. Best-effort, in its own catch:
an unsent confirmation request must never fail a delivery that actually
happened.

## 9. API

### 9.1 `POST /api/expedion/quotes/:id/confirm`

Authenticated with `requireExpedionCaller` — session, Firebase ID token or
shared key, as everywhere else under `/api/expedion`.

| | |
|---|---|
| Body | `{ milestone: "PICKED_UP" \| "DELIVERED", note?: string }` |
| 200 | the confirmation |
| 403 | `FORBIDDEN` — the caller does not own the quote and is not an admin |
| 404 | `QUOTE_NOT_FOUND`, or `SHIPMENT_NOT_FOUND` when the quote has no listing or the listing no shipment |
| 409 | `MILESTONE_NOT_REACHED`, `SHIPMENT_CANCELLED` |

Ownership is decided by `expedionService.getQuote(id, caller)` — the route
resolves the credential and hands it down, and the service enforces
(`docs/rules.md` §1.4). That is why a non-owner gets **404, not 403**: nobody
should learn which quote ids exist.

An admin caller may confirm on a client's behalf. When the admin is not the
quote owner the row is written with `confirmed_by_role = 'operator'`, and every
surface — the two timelines and the Expedion event — says so, so nothing ever
claims the client answered when an operator did. An admin answering for their
*own* quote is still `client`.

### 9.2 `POST /api/shipments/confirm`

**Unauthenticated.** Body `{ token: string, note?: string }`.

| | |
|---|---|
| 200 | the confirmation |
| 410 | `INVALID_TOKEN` — bad signature, malformed, or expired |
| 409 | `MILESTONE_NOT_REACHED`, `SHIPMENT_CANCELLED` |

Rate-limited through `src/lib/rate-limit.ts` on the client IP: this is the only
route in the app that writes without a session.

### 9.3 `GET /api/shipments/confirm?token=…`

The read half of §7.3, for the landing page. Same `410` on a bad token.

### 9.4 Shipment detail

`shipmentService.getShipmentDetail` and `getUserShipments` gain
`confirmations: Array<{ milestone, channel, confirmedByRole, createdAt }>`.
Folded into the existing payload so no surface needs a second round trip. The
driver projection keeps them — that the client confirmed is not a commercial
fact — but drops `confirmedByUserId` and `confirmedByRef`.

## 10. UI

**`/confirm/[token]`** — public, in the `(marketing)` group. One card: what is
being confirmed, the route (cities), a primary button, and a done state.
FR/EN, light and dark. Five terminal states, each with its own copy, because a
reader who arrived from an SMS has no other way to find out what happened:
just-confirmed, already-confirmed, cancelled, not-yet-reached, and dead link.
A failed *load* says so rather than reusing the failed-*save* sentence.

`isDone` is read **before** `alreadyConfirmed` and independently of it. The
successful mutation invalidates the describe query, so by the time the refetch
lands `alreadyConfirmed` is true — reading it first told a client who had just
confirmed for the first time that they had already done it.

**`/deliveries/[id]` timeline** — each attestable milestone shows its
attestation state: *Confirmé par le client* with a date, or *En attente de
confirmation du client*. Absent on milestones §4 excludes.

**Driver run detail** — the same two lines, so a driver can see whether the
client has signed off before chasing.

**Expedion app** (`suivi_de_livraison`, sibling repo) — a card above the
history asking for the milestone the quote's own stage implies: `picked_up`
asks for `PICKED_UP`, `delivered` for `DELIVERED`, anything earlier asks for
nothing. Whether the client has already answered is read off the shared event
feed rather than a new endpoint — §7.1 step 5 mirrors every confirmation there,
from whichever channel it arrived on, so a client who tapped the link in their
SMS is not asked again in the app. The copy says confirming commits no payment
and changes nothing, because a client who suspects the button might charge them
will not press it.

## 11. Known limitation, recorded on purpose

*En cours de livraison* is visible on Expeditoo's surfaces and **not** to the
Expedion client. `expedion-bridge.service.ts` maps `IN_TRANSIT` onto
`picked_up` deliberately (the Expedion lifecycle has no in-transit stage), and
the Flutter stepper has five fixed steps ending at *Livraison*. Giving the
client that third step there needs a new `expedion_quote_status` value, a
transition-map entry and a Flutter change — out of scope for a relabel.

## 12. Test coverage required

**`confirmation-token.ts`**
- round-trips a shipment id and milestone
- rejects a tampered payload, a tampered signature, and a truncated token
- rejects an expired token
- mints and verifies nothing when `BETTER_AUTH_SECRET` is unset

**`shipmentConfirmationsService`**
- `PICKED_UP` before pickup ⇒ `MILESTONE_NOT_REACHED`
- `DELIVERED` while `IN_TRANSIT` ⇒ `MILESTONE_NOT_REACHED`
- `PICKED_UP` while `IN_TRANSIT` and while `DELIVERED` ⇒ allowed
- any milestone on a cancelled shipment ⇒ `SHIPMENT_CANCELLED`
- a second attest on the same (shipment, milestone) returns the first row and
  inserts nothing
- **an attestation leaves `shipments.status` untouched** and writes no
  `shipment_events` row — the guarantee of §1, asserted directly
- a quote-less listing mirrors nothing and does not throw

**Routes**
- the Expedion route refuses a caller who owns a different quote
- the link route answers `410` for a token signed with another secret

**Bridge**
- `writeBack` appends the confirm link to the pickup SMS and sends it once
  across the `PICKED_UP` → `IN_TRANSIT` pair
