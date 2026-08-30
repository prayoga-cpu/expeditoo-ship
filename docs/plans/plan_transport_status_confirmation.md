# Plan: Transport status confirmation

**Spec:** `docs/specs/transport_status_confirmation_spec.md`
**Related:** `docs/specs/shipment_spec.md`, `docs/specs/shipment_events_spec.md`,
`docs/specs/expedion_post_payment_fork_spec.md`
**Date:** 2026-08-29

---

## 1. The ask

> Status should update automatically each time there's a confirmation from
> either the transporter or the client. Example statuses: En préparation,
> En retrait, En cours de livraison, etc.

## 2. What is already true

The status machine exists and is already confirmation-shaped on the driver's
half: the button that moves `ASSIGNED → PICKED_UP` is literally labelled
*Confirmer le retrait*. Three things are missing.

1. **The client has no half.** `shipmentService.updateStatus` accepts
   `carrier`, `driver` or `staff` and throws `FORBIDDEN` for the shipper.
   `/deliveries` is read-only tracking; the only mutation a client owns is
   cancellation.
2. **Nothing is stored as a confirmation.** `shipment_events` records who
   *moved* the status, which is not the same fact as who *confirmed* the
   milestone. There is nowhere to put "the driver says collected" and "the
   client says collected" as two rows about one moment.
3. **The names do not match the ask.** `ASSIGNED` reads "Assignée",
   `IN_TRANSIT` reads "En transit".

## 3. Decisions taken (2026-08-29)

| Question | Answer |
|---|---|
| Does one side's confirmation advance the status? | **No — driver moves, client attests.** The state machine is untouched; the client stamps an acknowledgement onto a step they cannot move. |
| Where does the client confirm? | **Expedion app** (authenticated, over the bridge) **and a one-tap link** in the existing SMS/email. Not `/deliveries`, not an operator stand-in. |
| New database states? | **No — relabel only.** The six statuses stay; FR/EN strings change. |

The first decision is the load-bearing one. A client attestation grants
**nothing**: it cannot move a status, capture a payment, close a listing or
release a hold. That is what makes a public one-tap link safe to mail.

## 4. Steps

| # | Step | Files |
|---|---|---|
| 1 | Relabel the six statuses in FR and EN, both surfaces plus the timeline event names | `messages/fr.json`, `messages/en.json` |
| 2 | `shipment_confirmations` table + `shipment_confirmation_channel` enum; unique on (shipment, milestone) | `src/db/schema/shipments.ts`, new migration |
| 3 | Signed stateless confirm token (HMAC-SHA256 on `BETTER_AUTH_SECRET`) | `src/lib/confirmation-token.ts` + tests |
| 4 | DAL: record, list, list-for-many | `src/server/dal/shipments.dal.ts` |
| 5 | DTO: milestone schema, request/response shapes | `src/server/dto/shipment.dto.ts` |
| 6 | Service: `shipmentConfirmationsService` — attest, resolve token, request | `src/server/services/shipment-confirmations.service.ts` + tests |
| 7 | Fold confirmations into shipment detail so no surface needs a second call | `src/server/services/shipment.service.ts` |
| 8 | Request an attestation when the run reaches `PICKED_UP` / `DELIVERED` | `shipment.service.ts`, `expedion-bridge.service.ts`, `expedion-sms.service.ts` |
| 9 | Route: `POST /api/expedion/quotes/[id]/confirm` (Expedion app) | `src/app/api/expedion/quotes/[id]/confirm/route.ts` |
| 10 | Route: `POST /api/shipments/confirm` (link, unauthenticated, token-bearing) | `src/app/api/shipments/confirm/route.ts` |
| 11 | Public landing page for the link | `src/app/(marketing)/confirm/[token]/page.tsx` + feature UI |
| 12 | Show the attestation on the client timeline and the driver's run | `deliveries/ui/Timeline.tsx`, `driver/ui/*` |
| 13 | Flutter: a confirm button on the devis screen | `expedion_encheres` (separate repo) |

**Status:** steps 1-13 implemented on 2026-08-29.

## 5. Dependencies

- Step 3 before 6, 10, 11.
- Step 2 before 4.
- Step 8 depends on 3 and 6.
- Step 13 depends on 9 shipping first.

## 6. Deliberately out of scope

- **`/deliveries` confirmation for direct listings.** Not chosen. A direct
  listing's owner is a real session here and could confirm in-app; the link
  channel already reaches them by email, so nothing is unreachable.
- **A separate in-transit stage on the Expedion side.** The bridge collapses
  `IN_TRANSIT` onto `picked_up` on purpose. *En cours de livraison* is
  therefore visible on Expeditoo's surfaces and **not** on the Expedion
  client's five-step stepper. Fixing that is an `expedion_quote_status` enum
  value plus a Flutter stepper change — a separate piece of work, recorded in
  the spec §11.
- Any change to who may move a status.
