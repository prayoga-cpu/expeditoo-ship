# Plan — multiple time slots on an offer

Spec: `docs/specs/offer_time_slots_spec.md`.
Client ask, with the Cocolis *Faire une offre* screen as the reference:
**"allow the transporter to enter multiple time slots (not just one)."**

Today an offer carries exactly one `estimated_pickup` / `estimated_delivery`
pair, and that pair becomes the shipment's schedule on award. A driver who is
free on the 25th *or* the 27th has to pick one and hope.

## Order of work

1. **Pure resolution, tested first.** `src/lib/offer-slots.ts` — a proposed
   `(day, time of day)` pair to concrete instants, plus the delivery deadline
   the lead implies. Built on `slotInterval`, newly exported from
   `src/lib/availability-window.ts` so the hour table stays written once.
2. **Schema + migration.** `offer_slots` child table and
   `offers.delivery_lead_days`; `0013_offer_slots.sql` **registered in the
   journal** in the same commit (`migrations-journal.test.ts` fails otherwise).
3. **DTO.** `createOfferSchema` swaps the two datetimes for `slots`,
   `deliveryLeadDays` and `tzOffset`; `acceptOfferSchema` is new;
   `offerOutputSchema` gains the slot list.
4. **DAL.** Insert slots with the offer, read them back everywhere an offer is
   read, and rewrite the offer's schedule when a slot is booked.
5. **Service.** Resolve and validate slots against the listing window, derive
   the stored pair from the earliest slot, and let `acceptOffer` take a
   `slotId`. `takeJob` and `expedionEscalationService.assignDirect` move to the
   empty-slot form and stop naming dates the listing already carries.
6. **Routes.** `POST /api/offers/:id/accept` reads an optional `slotId` from a
   body that may not be there.
7. **UI.** `OfferSlotsField` (the driver's proposal), `SubmitOfferForm`
   rebuilt around it, `OfferCard` showing the slots and — for whoever may
   award — choosing between them.
8. **i18n.** FR and EN at exact parity. `SubmitOfferForm` and `OfferCard` are
   hardcoded English today; they are translated here rather than growing a
   third language.
9. **Gates.** `npx tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Dependencies

3 depends on 1 and 2. 4 depends on 2 and 3. 5 depends on 4. 7 depends on 3 and
on the API types in 6. 8 depends on 7.

## Deliberate non-changes

- **The listing side is untouched.** A job still posts one contiguous pickup
  window. The slots are the *carrier's* proposal against it.
- **No fourth period.** `morning` / `afternoon` / `evening` is the vocabulary
  the board search already speaks and already translates; "en journée" is all
  three, not a new enum value.
- **No renegotiation after award.** Booking a slot happens once, at accept.
  Moving a shipment afterwards is `PATCH /api/shipments/:id`'s job and is not
  in scope.
- **`estimated_pickup` / `estimated_delivery` stay on `offers`.** They hold the
  booked slot (the earliest, until one is chosen), so `pickup_asc`, `MyOffers`,
  the shipment write and the Expedion write-back keep working untouched. A
  parallel truth is the cost; a rewrite of every reader is the alternative.
