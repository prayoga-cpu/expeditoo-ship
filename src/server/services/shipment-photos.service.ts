import { nanoid } from "nanoid";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { shipmentPhotosDal } from "@/server/dal/shipment-photos.dal";
import { shipmentPhotoStorageService } from "@/server/services/shipment-photo-storage.service";
import { photoStampService } from "@/server/services/photo-stamp.service";
import { reverseGeocode } from "@/lib/geocoding";
import {
  groupShipmentPhotos,
  toShipmentPhotoView,
  type ShipmentPhotoCaptureInput,
  type ShipmentPhotoGroups,
} from "@/server/dto/shipment-photo.dto";
import {
  EXECUTING_PARTIES,
  partyFor,
  shipmentErr as err,
  type Party,
  type Viewer,
} from "@/server/services/shipment-access";
import type {
  ActorRoleType,
  ShipmentPhoto,
  ShipmentPhotoStage,
  ShipmentStatusType,
} from "@/db/schema/shipments";

/**
 * Pickup and delivery photos — see docs/specs/shipment_photos_spec.md.
 *
 * A photo here is evidence, and three rules follow from that word.
 *
 * 1. **It is taken at the moment it describes.** A stage is only open while
 *    the run is at the status that stage documents (§3.3). A pickup photo
 *    added after the goods moved would prove nothing about how they left.
 * 2. **It carries where it was taken**, from a live device fix posted with the
 *    bytes — not from EXIF, which is editable with a text editor.
 * 3. **Nobody with an interest can change it.** There is no update path in
 *    this module. Removal is admin-only and soft.
 */

/** Which shipment status each stage is allowed to be photographed at. */
const STAGE_WINDOW: Record<ShipmentPhotoStage, ShipmentStatusType> = {
  pickup: "ASSIGNED",
  delivery: "IN_TRANSIT",
};

/** Enough for several angles of one load; few enough to bound the bucket. */
const MAX_PER_STAGE = 6;

/** Phone cameras produce 4-8 MB. This bounds the function's memory. */
const MAX_BYTES = 12 * 1024 * 1024;

/** A geocoder being slow must never cost a driver their delivery. */
const GEOCODE_TIMEOUT_MS = 2500;

/**
 * Best-effort address for the burn-in. Every failure — network, rate limit,
 * a coordinate in the middle of a field — resolves to null, and the stamp
 * simply omits the line.
 */
async function describeLocation(
  lat: number,
  lng: number
): Promise<string | null> {
  /*
   * The timer is cleared in `finally` rather than left to fire. Uncleared, it
   * holds the event loop open for the rest of its 2.5 s on every upload -
   * which on a serverless function is 2.5 s of billed wall-clock added to a
   * request that already has its answer.
   */
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), GEOCODE_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([reverseGeocode(lat, lng), timeout]);
    if (!result) return null;

    const label = [
      result.street,
      [result.postalCode, result.city].filter(Boolean).join(" "),
    ]
      .filter((part) => part && part.trim())
      .join(", ");

    return label || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** `shipment_events` wants a role, and `staff` is not one of them. */
const actorRoleFor = (party: Party): ActorRoleType =>
  party === "staff" ? "admin" : (party as ActorRoleType);

/** Short enough to fit the burn-in, long enough to trace a loose photo back. */
const shipmentRef = (shipmentId: string) =>
  `EXP-${shipmentId.slice(0, 6).toUpperCase()}`;

/** The party-facing address of one photo. Never an R2 key, never presigned. */
const partyPhotoUrl = (shipmentId: string, photoId: string) =>
  `/api/shipments/${shipmentId}/photos/${photoId}`;

export const shipmentPhotosService = {
  /**
   * Stamp, store, record — in that order.
   *
   * The object is written before the row, so a crash leaves an orphan object
   * costing pennies rather than a row pointing at nothing, which is a broken
   * image in the client's face. The stamp happens before the upload, so no
   * unstamped copy is ever stored.
   */
  async capture(
    shipmentId: string,
    input: ShipmentPhotoCaptureInput,
    file: { buffer: Buffer; mimeType: string },
    viewer: Viewer
  ) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);
    // The shipper is the client, and reads this. Evidence one party can add to
    // is not evidence.
    if (!EXECUTING_PARTIES.includes(party)) throw err("FORBIDDEN", 403);

    if (ownership.status !== STAGE_WINDOW[input.stage]) {
      throw err("PHOTO_STAGE_NOT_OPEN", 409);
    }

    if (!file.mimeType.startsWith("image/")) {
      throw err("INVALID_FILE_TYPE", 415);
    }
    if (file.buffer.byteLength > MAX_BYTES) {
      throw err("FILE_TOO_LARGE", 413);
    }

    const existing = await shipmentPhotosDal.countForStage(
      shipmentId,
      input.stage
    );
    if (existing >= MAX_PER_STAGE) throw err("PHOTO_LIMIT_REACHED", 409);

    const capturedAddress = await describeLocation(input.lat, input.lng);
    const recordedAt = new Date();

    const stamped = await photoStampService.stamp(file.buffer, {
      stage: input.stage,
      lat: input.lat,
      lng: input.lng,
      accuracyM: input.accuracyM ?? null,
      address: capturedAddress,
      recordedAt,
      shipmentRef: shipmentRef(shipmentId),
    });

    const objectKey = await shipmentPhotoStorageService.upload(
      shipmentId,
      input.stage,
      stamped.buffer,
      stamped.mimeType
    );

    const photo = await shipmentPhotosDal.create({
      id: nanoid(),
      shipmentId,
      stage: input.stage,
      objectKey,
      mimeType: stamped.mimeType,
      sizeBytes: stamped.sizeBytes,
      capturedLat: input.lat,
      capturedLng: input.lng,
      capturedAccuracyM: input.accuracyM ?? null,
      capturedAddress,
      capturedAt: input.capturedAt,
      recordedAt,
      uploadedByUserId: viewer.userId,
    });

    // Onto the timeline both parties already read, so a photo announces itself
    // without any surface having to poll for one.
    await shipmentsDal
      .createEvent({
        id: nanoid(),
        shipmentId,
        status: ownership.status,
        previousStatus: null,
        actorId: viewer.userId,
        actorRole: actorRoleFor(party),
        note:
          input.stage === "pickup"
            ? "Pickup photo added"
            : "Delivery photo added",
        metadata: JSON.stringify({
          photoId: photo.id,
          stage: input.stage,
          lat: input.lat,
          lng: input.lng,
          address: capturedAddress,
        }),
      })
      .catch((error) => console.error("photo event failed", error));

    // Through the same projection `list` uses, rather than a second literal:
    // a field added to `ShipmentPhotoView` would otherwise be silently absent
    // from the response the capture itself returns.
    return toShipmentPhotoView(photo, partyPhotoUrl(shipmentId, photo.id));
  },

  /** Every party to the run, the client included. That is the point of it. */
  async list(shipmentId: string, viewer: Viewer): Promise<ShipmentPhotoGroups> {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);
    if (partyFor(ownership, viewer) === "none") throw err("FORBIDDEN", 403);

    const photos = await shipmentPhotosDal.listForShipment(shipmentId);
    return groupShipmentPhotos(photos, (photo) =>
      partyPhotoUrl(shipmentId, photo.id)
    );
  },

  /**
   * Authorise, then hand back a five-minute link.
   *
   * A photo id that belongs to another shipment answers `PHOTO_NOT_FOUND`
   * rather than `FORBIDDEN`, and mints nothing on the way — the same rule
   * `/api/expedion/files/:id` follows, so the two cases cannot be told apart
   * by a caller probing for ids.
   */
  async presign(shipmentId: string, photoId: string, viewer: Viewer) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);
    if (partyFor(ownership, viewer) === "none") throw err("FORBIDDEN", 403);

    const photo = await shipmentPhotosDal.getForShipment(shipmentId, photoId);
    if (!photo) throw err("PHOTO_NOT_FOUND", 404);

    return await shipmentPhotoStorageService.presignRead(photo.objectKey);
  },

  /**
   * Admin only, and soft.
   *
   * An operator is deliberately not enough: operators award jobs, and one who
   * could remove evidence would be deciding a dispute about material they
   * control. The row and the R2 object both survive; only the listings stop
   * showing it, and the removal is itself written to the timeline.
   *
   * Deleting the last photo of a stage does not roll a status back. The
   * transition was legal when it happened, and rewriting history to match a
   * later deletion is not what an audit trail is.
   */
  async remove(
    shipmentId: string,
    photoId: string,
    reason: string,
    viewer: Viewer
  ) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);
    if (!viewer.isAdmin) throw err("FORBIDDEN", 403);

    const photo = await shipmentPhotosDal.getForShipment(shipmentId, photoId);
    if (!photo) throw err("PHOTO_NOT_FOUND", 404);

    const deleted = await shipmentPhotosDal.softDelete(
      photoId,
      viewer.userId,
      reason
    );

    await shipmentsDal
      .createEvent({
        id: nanoid(),
        shipmentId,
        status: ownership.status,
        previousStatus: null,
        actorId: viewer.userId,
        actorRole: "admin",
        note: `${photo.stage === "pickup" ? "Pickup" : "Delivery"} photo removed: ${reason}`,
        metadata: JSON.stringify({ photoId, stage: photo.stage }),
      })
      .catch((error) => console.error("photo removal event failed", error));

    return { id: photoId, deletedAt: deleted?.deletedAt ?? new Date() };
  },

  /**
   * The transition gate's question, asked by `shipment.service`. No viewer:
   * whether evidence exists is a fact about the run, not about who is looking.
   */
  async hasStagePhoto(shipmentId: string, stage: ShipmentPhotoStage) {
    return (await shipmentPhotosDal.countForStage(shipmentId, stage)) > 0;
  },

  // ---- Expedion-facing ----
  //
  // An escalated job belongs to the Expedion system account, so its client is
  // a quote owner with no `user` row and no party seat: `list` and `presign`
  // above cannot reach them. These two take no viewer because the caller has
  // already been authorised as the quote's owner by `requireExpedionCaller`.

  /**
   * Empty groups rather than a 404 when the quote has no listing or no
   * shipment yet: "nothing has been photographed" is a normal state on a
   * tracking screen, not an error.
   */
  async listForListing(
    listingId: string,
    urlFor: (photo: ShipmentPhoto) => string
  ): Promise<ShipmentPhotoGroups> {
    const shipment = await shipmentsDal.getByListingId(listingId);
    if (!shipment) return { pickup: [], delivery: [] };

    const photos = await shipmentPhotosDal.listForShipment(shipment.id);
    return groupShipmentPhotos(photos, urlFor);
  },

  async presignForListing(listingId: string, photoId: string) {
    const shipment = await shipmentsDal.getByListingId(listingId);
    if (!shipment) throw err("PHOTO_NOT_FOUND", 404);

    const photo = await shipmentPhotosDal.getForShipment(shipment.id, photoId);
    if (!photo) throw err("PHOTO_NOT_FOUND", 404);

    return await shipmentPhotoStorageService.presignRead(photo.objectKey);
  },

  /** Counts for the Expedion write-back, so the feed can announce photos. */
  async stageCounts(shipmentId: string) {
    const [pickup, delivery] = await Promise.all([
      shipmentPhotosDal.countForStage(shipmentId, "pickup"),
      shipmentPhotosDal.countForStage(shipmentId, "delivery"),
    ]);
    return { pickup, delivery };
  },
};
