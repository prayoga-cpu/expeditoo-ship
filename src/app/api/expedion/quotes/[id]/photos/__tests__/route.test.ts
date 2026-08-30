import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Expedion client's only way in. An escalated job belongs to the Expedion
 * system account, so its client holds no `user` row and no party seat — these
 * two routes are what shipment_photos_spec.md §7.3 promises them.
 *
 * `expedionService.getQuote` is mocked, but its *contract* is what is tested
 * around: it 404s a non-owner rather than 403ing, and that must be what the
 * caller sees here too rather than being flattened into a 500.
 */

vi.mock("@/lib/expedion-auth", () => ({
  requireExpedionCaller: vi.fn(),
  ExpedionAuthError: class extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
      message?: string
    ) {
      super(message ?? code);
    }
  },
}));
vi.mock("@/server/services/expedion.service", async () => {
  class ExpedionError extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
      message?: string
    ) {
      super(message ?? code);
    }
  }
  return { ExpedionError, expedionService: { getQuote: vi.fn() } };
});
vi.mock("@/server/services/shipment-photos.service", () => ({
  shipmentPhotosService: {
    listForListing: vi.fn(),
    presignForListing: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { GET as LIST } from "../route";
import { GET as READ } from "../[photoId]/route";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import {
  ExpedionError,
  expedionService,
} from "@/server/services/expedion.service";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";

const OWNER = { userId: "firebase-uid-1", isAdmin: false };
const PRESIGNED = "https://r2.example.com/shipments/ship-1/pickup-abc?sig=1";

const listParams = { params: Promise.resolve({ id: "quote-1" }) };
const readParams = {
  params: Promise.resolve({ id: "quote-1", photoId: "photo-1" }),
};

const req = (path = "/api/expedion/quotes/quote-1/photos") =>
  new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireExpedionCaller).mockResolvedValue(OWNER as never);
  vi.mocked(expedionService.getQuote).mockResolvedValue({
    id: "quote-1",
    listingId: "job-1",
  } as never);
  vi.mocked(shipmentPhotosService.listForListing).mockResolvedValue({
    pickup: [],
    delivery: [],
  });
  vi.mocked(shipmentPhotosService.presignForListing).mockResolvedValue(
    PRESIGNED
  );
});

describe("GET /api/expedion/quotes/:id/photos", () => {
  it("refuses a non-owner with the quote's own 404, and reads no photos", async () => {
    vi.mocked(expedionService.getQuote).mockRejectedValue(
      new ExpedionError("QUOTE_NOT_FOUND", 404)
    );

    const response = await LIST(req(), listParams);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("QUOTE_NOT_FOUND");
    expect(shipmentPhotosService.listForListing).not.toHaveBeenCalled();
  });

  /*
   * The run may not even have a driver yet. An error here would put a failure
   * on the client's tracking screen for a job progressing perfectly well.
   */
  it("answers empty groups for a quote that has not been escalated", async () => {
    vi.mocked(expedionService.getQuote).mockResolvedValue({
      id: "quote-1",
      listingId: null,
    } as never);

    const response = await LIST(req(), listParams);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ pickup: [], delivery: [] });
    expect(shipmentPhotosService.listForListing).not.toHaveBeenCalled();
  });

  it("addresses every photo back through this quote, never at R2", async () => {
    await LIST(req(), listParams);

    const [listingId, urlFor] = vi.mocked(shipmentPhotosService.listForListing)
      .mock.calls[0];
    expect(listingId).toBe("job-1");
    expect(urlFor({ id: "photo-9" } as never)).toBe(
      "/api/expedion/quotes/quote-1/photos/photo-9"
    );
  });
});

describe("GET /api/expedion/quotes/:id/photos/:photoId", () => {
  it("redirects the owner to a link no cache may keep", async () => {
    const response = await READ(req(), readParams);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(PRESIGNED);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  // Being able to read one quote grants nothing about any other job's photos.
  it("resolves the photo through this quote's own listing", async () => {
    await READ(req(), readParams);

    expect(shipmentPhotosService.presignForListing).toHaveBeenCalledWith(
      "job-1",
      "photo-1"
    );
  });

  it("404s a photo on a quote with no listing, and mints nothing", async () => {
    vi.mocked(expedionService.getQuote).mockResolvedValue({
      id: "quote-1",
      listingId: null,
    } as never);

    const response = await READ(req(), readParams);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("PHOTO_NOT_FOUND");
    expect(shipmentPhotosService.presignForListing).not.toHaveBeenCalled();
  });
});
