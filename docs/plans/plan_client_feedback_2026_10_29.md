# Plan — client feedback of 28–29 October 2026 (2.66.0 →)

Spec: `docs/specs/client_feedback_2026_10_29_spec.md`. Monitor: top of `STATUS.md`.
Source: `EXPEDITOO Client Feedback Consolidated 29.10.2026.pdf` — the 21 October
review (A1–D6, X1), the driver field test (REQ-01–08), Nicolas's answers of
28–29 October and two features he added (N1–N9).

## Releases

| Release | Items | Migration | Depends on |
|---|---|---|---|
| 2.66.0 | A2, A4, B3, B5, C3 (Apple Pay / Google Pay), N2, N5, REQ-02, REQ-07 | `0042_carrier_absence_deregistration` | — |
| 2.67.0 | B1 (Expeditoo's pick), B6 (range, counter-price loop), N1 (booking summary before the card) | `0043_offer_proposal_counter` | 2.66.0 |
| 2.68.0 | D2 map view on « Mes demandes », « Ma position », round trip, the search area drawn | — | — |
| 2.69.0 | N3 (release sweep, inert until Connect + crons), N4 (dispute hold), N6 (payout mail), N7 (driver SMS); A2's window parameters fixed | — | 2.66.0 |
| 2.70.0 | N8 route planner (Valhalla, with and without motorways) | — | — |

| 2.71.0 | The owner's decisions of 30 October: park a paid quote's auto-publish (X1), payouts stay manual (release sweep unscheduled), `carriers.kind` (REQ-01), driver alerts by email as well as text (N7), sender `no-reply@prionation.io` (C4, a variable) | `0044_carrier_kind` | 2.70.0 |

Decided on 30 October, not built: PayPal (skipped), the private-driver lane
(REQ-06/08, waits on the definition), Airtable sync (stays a one-way import),
a « propose another date » button (messages instead).

## 2.66.0 steps

| Step | Item | Files |
|---|---|---|
| 1 | A4 bare number; admin columns; requester name on the shipments row | `listing-reference.ts`, `ListingReference.tsx` + callers, `ListingsTable.tsx`, `DeliveriesTable.tsx`, `RequesterCell.tsx`, `initials.ts`, `shipments.dal.ts`, `shipment.service.ts`, `useAdminShipments.ts` |
| 2 | B5 `isImmediate`, `UrgencyBadge` | `urgency.ts`, `UrgencyBadge.tsx` + callers |
| 3 | B3 tag wording | `messages/*.json` |
| 4 | A2 server page of quotes; order toggle; pager | `expedion-report.dal.ts`, `expedion-report.service.ts`, `api/admin/expedion/quotes`, `useExpedionReport.ts`, `RecentQuotesPanel.tsx` |
| 5 | N2 order / period / dates; N5 payments link | `shipment-list.ts`, `MyShipments.tsx`, `CarrierTripsScreen.tsx` |
| 6 | REQ-02 schema + rule + gates + transitions + screens | `0042`, `carriers.ts`, `carrier-availability.ts`, `carrier.service.ts`, `offers.service.ts`, `thread-offers.service.ts`, `expedion-escalation.service.ts`, `carrier-routes.dal.ts`, `offers.dal.ts`, `shipments.dal.ts`, five routes, admin + driver UI |
| 7 | REQ-07 admin alert | `carrier.service.ts`, `email.service.ts`, `DriverApplicationSubmittedEmail.tsx` |
| 8 | C3 wallets | `AcceptPaymentDialog.tsx` |
| 9 | Gates, release files, migrate `0042` before `main` moves | — |
