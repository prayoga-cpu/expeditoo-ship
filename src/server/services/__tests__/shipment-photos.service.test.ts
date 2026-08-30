import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Covers docs/specs/shipment_photos_spec.md §9.
 *
 * Storage and Sharp are mocked: what matters about a capture is who is allowed
 * to make one, when, and that the bytes reaching the bucket are the *stamped*
 * bytes rather than the ones that arrived. What Sharp does with an image is
 * Sharp's problem, and is covered in `photo-stamp.service.test.ts`.
 *
 * Nominatim is mocked to a rejection in one case on purpose: a geocoder being
 * unreachable must still produce a photo.
 */

vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: {
    getOwnership: vi.fn(),
    getByListingId: vi.fn(),
    createEvent: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/server/dal/shipment-photos.dal", () => ({
  shipmentPhotosDal: {
    create: vi.fn(),
    listForShipment: vi.fn().mockResolvedValue([]),
    getForShipment: vi.fn(),
    countForStage: vi.fn().mockResolvedValue(0),
    softDelete: vi.fn(),
  },
}));
vi.mock("@/server/services/shipment-photo-storage.service", () => ({
  shipmentPhotoStorageService: {
    upload: vi.fn().mockResolvedValue("shipments/ship-1/pickup-abc"),
    presignRead: vi.fn().mockResolvedValue("https://r2.example.com/x?sig=1"),
  },
}));
vi.mock("@/server/services/photo-stamp.service", () => ({
  photoStampService: {
    stamp: vi.fn().mockResolvedValue({
      buffer: Buffer.from("STAMPED"),
      mimeType: "image/webp",
      sizeBytes: 7,
    }),
  },
}));
vi.mock("@/lib/geocoding", () => ({ reverseGeocode: vi.fn() }));

import { shipmentPhotosService } from "../shipment-photos.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { shipmentPhotosDal } from "@/server/dal/shipment-photos.dal";
import { shipmentPhotoStorageService } from "@/server/services/shipment-photo-storage.service";
import { photoStampService } from "@/server/services/photo-stamp.service";
import { reverseGeocode } from "@/lib/geocoding";

const BASE = {
  id: "ship-1",
  listingId: "job-1",
  shipperId: "shipper-1",
  carrierId: "carrier-1",
  driverId: "driver-1",
};

const DRIVER = { userId: "driver-1" };
const SHIPPER = { userId: "shipper-1" };
const CARRIER = { userId: "carrier-1" };
const OPERATOR = { userId: "ops-1", isOperator: true };
const ADMIN = { userId: "admin-1", isAdmin: true };
const STRANGER = { userId: "nobody" };

const FIX = {
  stage: "pickup" as const,
  lat: 48.86919,
  lng: 2.33144,
  accuracyM: 8,
  capturedAt: new Date("2026-08-29T12:32:00Z"),
};

const FILE = { buffer: Buffer.from("ORIGINAL"), mimeType: "image/jpeg" };

function atStatus(status: string) {
  vi.mocked(shipmentsDal.getOwnership).mockResolvedValue({
    ...BASE,
    status,
  } as never);
}

function storedPhoto(over: Record<string, unknown> = {}) {
  return {
    id: "photo-1",
    shipmentId: "ship-1",
    stage: "pickup",
    objectKey: "shipments/ship-1/pickup-abc",
    mimeType: "image/webp",
    sizeBytes: 7,
    capturedLat: FIX.lat,
    capturedLng: FIX.lng,
    capturedAccuracyM: 8,
    capturedAddress: "12 rue de la Paix, 75002 Paris",
    capturedAt: FIX.capturedAt,
    recordedAt: new Date("2026-08-29T12:32:05Z"),
    uploadedByUserId: "driver-1",
    deletedAt: null,
    deletedByUserId: null,
    deletionReason: null,
    createdAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  atStatus("ASSIGNED");
  vi.mocked(shipmentPhotosDal.countForStage).mockResolvedValue(0);
  vi.mocked(shipmentPhotosDal.create).mockResolvedValue(storedPhoto() as never);
  vi.mocked(reverseGeocode).mockResolvedValue({
    street: "12 rue de la Paix",
    city: "Paris",
    postalCode: "75002",
    country: "France",
    countryCode: "fr",
  } as never);
  vi.mocked(photoStampService.stamp).mockResolvedValue({
    buffer: Buffer.from("STAMPED"),
    mimeType: "image/webp",
    sizeBytes: 7,
  } as never);
  vi.mocked(shipmentPhotoStorageService.upload).mockResolvedValue(
    "shipments/ship-1/pickup-abc"
  );
});

describe("who may add evidence", () => {
  it.each([
    ["driver", DRIVER],
    ["carrier", CARRIER],
    ["staff", OPERATOR],
  ])("accepts the %s", async (_label, viewer) => {
    await expect(
      shipmentPhotosService.capture("ship-1", FIX, FILE, viewer)
    ).resolves.toMatchObject({ id: "photo-1" });
  });

  // The client reads this. Evidence one party can add to is not evidence.
  it("refuses the shipper, and stores nothing", async () => {
    await expect(
      shipmentPhotosService.capture("ship-1", FIX, FILE, SHIPPER)
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(shipmentPhotoStorageService.upload).not.toHaveBeenCalled();
    expect(shipmentPhotosDal.create).not.toHaveBeenCalled();
  });

  it("refuses someone who is not a party at all", async () => {
    await expect(
      shipmentPhotosService.capture("ship-1", FIX, FILE, STRANGER)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("the stage window", () => {
  it("refuses a pickup photo once the run has moved past ASSIGNED", async () => {
    atStatus("IN_TRANSIT");

    await expect(
      shipmentPhotosService.capture("ship-1", FIX, FILE, DRIVER)
    ).rejects.toMatchObject({ code: "PHOTO_STAGE_NOT_OPEN", status: 409 });
  });

  it("refuses a delivery photo before the goods are moving", async () => {
    atStatus("ASSIGNED");

    await expect(
      shipmentPhotosService.capture(
        "ship-1",
        { ...FIX, stage: "delivery" },
        FILE,
        DRIVER
      )
    ).rejects.toMatchObject({ code: "PHOTO_STAGE_NOT_OPEN" });
  });

  it("accepts a delivery photo while IN_TRANSIT", async () => {
    atStatus("IN_TRANSIT");

    await expect(
      shipmentPhotosService.capture(
        "ship-1",
        { ...FIX, stage: "delivery" },
        FILE,
        DRIVER
      )
    ).resolves.toBeDefined();
  });
});

describe("the file itself", () => {
  it("refuses anything that is not an image", async () => {
    await expect(
      shipmentPhotosService.capture(
        "ship-1",
        FIX,
        { buffer: Buffer.from("%PDF"), mimeType: "application/pdf" },
        DRIVER
      )
    ).rejects.toMatchObject({ code: "INVALID_FILE_TYPE", status: 415 });
  });

  it("refuses a payload over the cap", async () => {
    await expect(
      shipmentPhotosService.capture(
        "ship-1",
        FIX,
        { buffer: Buffer.alloc(12 * 1024 * 1024 + 1), mimeType: "image/jpeg" },
        DRIVER
      )
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
  });

  it("refuses the seventh photo of a stage", async () => {
    vi.mocked(shipmentPhotosDal.countForStage).mockResolvedValue(6);

    await expect(
      shipmentPhotosService.capture("ship-1", FIX, FILE, DRIVER)
    ).rejects.toMatchObject({ code: "PHOTO_LIMIT_REACHED", status: 409 });
  });

  // The whole point of stamping before storing: there is never an unstamped
  // copy in the bucket.
  it("stores the stamped bytes, not the ones that arrived", async () => {
    await shipmentPhotosService.capture("ship-1", FIX, FILE, DRIVER);

    const [, , body, mimeType] = vi.mocked(shipmentPhotoStorageService.upload)
      .mock.calls[0];
    expect(body.toString()).toBe("STAMPED");
    expect(body.toString()).not.toBe("ORIGINAL");
    expect(mimeType).toBe("image/webp");

    // And the stamp was handed the server's clock, never the device's.
    const stampArgs = vi.mocked(photoStampService.stamp).mock.calls[0][1];
    expect(stampArgs.recordedAt.getTime()).not.toBe(FIX.capturedAt.getTime());
  });
});

describe("the address is best effort", () => {
  it("still produces a photo when the geocoder throws", async () => {
    vi.mocked(reverseGeocode).mockRejectedValue(new Error("nominatim down"));
    vi.mocked(shipmentPhotosDal.create).mockResolvedValue(
      storedPhoto({ capturedAddress: null }) as never
    );

    await expect(
      shipmentPhotosService.capture("ship-1", FIX, FILE, DRIVER)
    ).resolves.toBeDefined();

    expect(vi.mocked(shipmentPhotosDal.create).mock.calls[0][0]).toMatchObject({
      capturedAddress: null,
    });
  });

  it("records the label when one comes back", async () => {
    await shipmentPhotosService.capture("ship-1", FIX, FILE, DRIVER);

    expect(vi.mocked(shipmentPhotosDal.create).mock.calls[0][0]).toMatchObject({
      capturedAddress: "12 rue de la Paix, 75002 Paris",
    });
  });
});

describe("reading", () => {
  it("lists for the shipper, who is the client", async () => {
    vi.mocked(shipmentPhotosDal.listForShipment).mockResolvedValue([
      storedPhoto(),
      storedPhoto({ id: "photo-2", stage: "delivery" }),
    ] as never);

    const groups = await shipmentPhotosService.list("ship-1", SHIPPER);

    expect(groups.pickup).toHaveLength(1);
    expect(groups.delivery).toHaveLength(1);
    // Never an R2 address: the object has no public URL.
    expect(groups.pickup[0].url).toBe("/api/shipments/ship-1/photos/photo-1");
  });

  it("refuses a non-party", async () => {
    await expect(
      shipmentPhotosService.list("ship-1", STRANGER)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("mints nothing for a photo belonging to another shipment", async () => {
    vi.mocked(shipmentPhotosDal.getForShipment).mockResolvedValue(
      undefined as never
    );

    await expect(
      shipmentPhotosService.presign("ship-1", "photo-elsewhere", DRIVER)
    ).rejects.toMatchObject({ code: "PHOTO_NOT_FOUND", status: 404 });

    expect(shipmentPhotoStorageService.presignRead).not.toHaveBeenCalled();
  });
});

describe("removal is admin-only and soft", () => {
  beforeEach(() => {
    vi.mocked(shipmentPhotosDal.getForShipment).mockResolvedValue(
      storedPhoto() as never
    );
    vi.mocked(shipmentPhotosDal.softDelete).mockResolvedValue(
      storedPhoto({ deletedAt: new Date() }) as never
    );
  });

  // An operator who could remove evidence would be deciding a dispute about
  // material they control.
  it("refuses an operator", async () => {
    await expect(
      shipmentPhotosService.remove("ship-1", "photo-1", "blurred", OPERATOR)
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(shipmentPhotosDal.softDelete).not.toHaveBeenCalled();
  });

  it("refuses the driver who took it", async () => {
    await expect(
      shipmentPhotosService.remove("ship-1", "photo-1", "oops", DRIVER)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets an admin remove it, keeps the row, and writes the reason down", async () => {
    await shipmentPhotosService.remove(
      "ship-1",
      "photo-1",
      "wrong shipment",
      ADMIN
    );

    expect(shipmentPhotosDal.softDelete).toHaveBeenCalledWith(
      "photo-1",
      "admin-1",
      "wrong shipment"
    );
    // The removal is itself on the record.
    expect(vi.mocked(shipmentsDal.createEvent).mock.calls[0][0]).toMatchObject({
      actorRole: "admin",
      note: expect.stringContaining("wrong shipment"),
    });
  });
});

describe("the Expedion client's view", () => {
  // The run may not even have a driver yet. An error there would show the
  // client's app a failure for a job progressing perfectly well.
  it("answers empty groups for a listing with no shipment", async () => {
    vi.mocked(shipmentsDal.getByListingId).mockResolvedValue(undefined as never);

    await expect(
      shipmentPhotosService.listForListing("job-1", () => "/x")
    ).resolves.toEqual({ pickup: [], delivery: [] });
  });
});
