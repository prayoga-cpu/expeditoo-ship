# Plan: Pickup & delivery photos

**Spec:** `docs/specs/shipment_photos_spec.md`
**Related:** `docs/specs/shipment_spec.md`,
`docs/specs/transport_status_confirmation_spec.md`,
`docs/specs/admin_expedion_clients_spec.md` (the private-storage pattern this
copies)
**Date:** 2026-08-29

---

## 1. The ask

> At pickup and at delivery, the transporter must be able to take and send
> photos to the platform showing the item is in good condition. The client
> should have access to these photos.

Answered on 2026-08-29, and the answers widened it:

| Question | Answer |
|---|---|
| Blocking? | **Required at both stages.** No photo, no `PICKED_UP`; no photo, no `DELIVERED`. |
| Location? | **Recorded on every photo**, in the database *and* burned into the pixels. |
| Editable? | **No — by anyone except an admin.** |
| Client sees them where? | Expeditoo web **and** the Expedion Flutter tracking screen. |
| Storage? | **Private**, behind an authorised route. |

## 2. What is already true

One photo exists: `shipments.proof_of_delivery_url`, a single `text` column
holding a **public** R2 URL, written by `POST /api/shipments/:id/proof-of-delivery`.
Three things about it are wrong for this ask.

1. **It is one photo, at one moment.** There is nothing at pickup, and no way
   to send a second angle.
2. **The upload also closes the run.** `uploadProofOfDelivery` sets the status
   to `DELIVERED`, captures the payment and schedules the payout in the same
   call. "Attach evidence" and "the goods arrived" cannot be separated, so a
   driver cannot photograph and then look again before committing.
3. **It is public.** `storage.service.ts` returns `${R2_PUBLIC_URL}/<key>`.
   Anyone holding the string reads it forever — a photo of the client's goods
   at the client's address.

`shipments.proof_of_delivery_url` is therefore replaced, not extended.

The private-storage pattern to copy already exists twice
(`kyc-storage.service.ts`, `expedion-storage.service.ts`): object key in the
row, no public URL, a route that authorises and then 302s to a five-minute
presigned URL.

## 3. Steps

| # | Step | Files |
|---|---|---|
| 1 | `shipment_photo_stage` enum + `shipment_photos` table; drop `shipments.proof_of_delivery_url` | `src/db/schema/shipments.ts` |
| 2 | Migration `0015_shipment_photos.sql`, registered in `meta/_journal.json`; legacy POD URLs preserved as timeline events | `src/db/migrations/` |
| 3 | Shared private-R2 factory, so this is not a third hand-copied S3 client | `src/server/services/storage/private-r2.ts` |
| 4 | `shipmentPhotoStorageService` on that factory | `src/server/services/shipment-photo-storage.service.ts` |
| 5 | Location burn-in with Sharp | `src/server/services/photo-stamp.service.ts` |
| 6 | DAL: insert, list by shipment, get one, soft-delete, count by stage | `src/server/dal/shipment-photos.dal.ts` |
| 7 | DTO: capture input, photo view | `src/server/dto/shipment-photo.dto.ts` |
| 8 | Service: capture / list / read / delete, all party-checked | `src/server/services/shipment-photos.service.ts` |
| 9 | Gate `→ PICKED_UP` and `→ DELIVERED` on a photo existing; delete `uploadProofOfDelivery` | `src/server/services/shipment.service.ts` |
| 10 | Routes: `POST`/`GET /api/shipments/[id]/photos`, `GET`/`DELETE /api/shipments/[id]/photos/[photoId]`; remove the proof-of-delivery route | `src/app/api/shipments/` |
| 11 | Expedion-facing read: `GET /api/expedion/quotes/[id]/photos` and `…/photos/[photoId]` | `src/app/api/expedion/quotes/[id]/photos/` |
| 12 | Bridge write-back carries the photo count so the tracking feed announces them | `src/server/services/expedion-bridge.service.ts` |
| 13 | Stop referencing the dropped column | `src/server/services/image-cleanup.service.ts`, `src/server/dto/shipment.dto.ts` |
| 14 | Driver capture UI: geolocation + camera, per stage, blocking | `src/features/app/driver/` |
| 15 | Client gallery on `/deliveries/[id]` | `src/features/app/deliveries/` |
| 16 | FR/EN strings, exact parity | `messages/fr.json`, `messages/en.json` |
| 17 | Flutter: `listShipmentPhotos` + a gallery on the tracking screen | `expedion_encheres` (separate repo) |

## 4. Dependencies

- 1 → 2 → everything that reads the table.
- 3 → 4. 4 and 5 → 8. 6 and 7 → 8. 8 → 9, 10, 11.
- 10 → 14, 15. 11 → 17.
- 16 is needed by 14 and 15 before either renders.

## 5. Deliberately out of scope

- **A staff override on the photo requirement.** The answer was "required at
  both stages", not "required unless an operator says otherwise". A run that
  genuinely cannot be photographed is a support matter, and support already has
  `cancelShipment`.
- **Client-side photo capture on the Expedion app.** The transporter takes the
  photos; the client reads them.
- **EXIF.** The device's own EXIF GPS is stripped by Sharp during
  re-encoding and is not read. It is trivially editable, which is the opposite
  of what this feature is for — the coordinates come from a live
  `navigator.geolocation` fix posted alongside the bytes.
- **Blocking on poor GPS accuracy.** Accuracy is recorded and stamped, never
  enforced. A driver in an underground car park still has a delivery to make.
