import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The read and the removal of one photo.
 *
 * Two things are asserted that a status code alone would not catch: that the
 * redirect is marked uncacheable, and that a refused read mints no presigned
 * URL. A shared cache holding a caller-specific link, or a URL minted before
 * the check, would both be leaks that still answered 403.
 */

vi.mock("@/server/services/viewer.service", () => ({
  resolveViewer: vi.fn(),
}));
vi.mock("@/server/services/shipment-photos.service", () => ({
  shipmentPhotosService: { presign: vi.fn(), remove: vi.fn() },
}));

import { GET, DELETE } from "../[photoId]/route";
import { resolveViewer } from "@/server/services/viewer.service";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";
import { ShipmentError } from "@/server/services/shipment-access";

const PRESIGNED = "https://r2.example.com/shipments/ship-1/pickup-abc?sig=1";
const PARAMS = {
  params: Promise.resolve({ id: "ship-1", photoId: "photo-1" }),
};

const request = (body?: unknown) =>
  new Request("http://localhost/api/shipments/ship-1/photos/photo-1", {
    method: body ? "DELETE" : "GET",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveViewer).mockResolvedValue({ userId: "driver-1" } as never);
  vi.mocked(shipmentPhotosService.presign).mockResolvedValue(PRESIGNED);
});

describe("GET one photo", () => {
  it("redirects to a presigned URL that no cache may keep", async () => {
    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(PRESIGNED);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("refuses an unauthenticated caller without minting anything", async () => {
    vi.mocked(resolveViewer).mockResolvedValue(null);

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(401);
    expect(shipmentPhotosService.presign).not.toHaveBeenCalled();
  });

  it("passes a service refusal through as its own status", async () => {
    vi.mocked(shipmentPhotosService.presign).mockRejectedValue(
      new ShipmentError("PHOTO_NOT_FOUND", 404)
    );

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("PHOTO_NOT_FOUND");
  });
});

describe("DELETE one photo", () => {
  it("requires a reason", async () => {
    const response = await DELETE(request({}), PARAMS);

    expect(response.status).toBe(400);
    expect(shipmentPhotosService.remove).not.toHaveBeenCalled();
  });

  it("hands the reason to the service", async () => {
    vi.mocked(shipmentPhotosService.remove).mockResolvedValue({
      id: "photo-1",
      deletedAt: new Date(),
    } as never);

    const response = await DELETE(request({ reason: "wrong shipment" }), PARAMS);

    expect(response.status).toBe(200);
    expect(shipmentPhotosService.remove).toHaveBeenCalledWith(
      "ship-1",
      "photo-1",
      "wrong shipment",
      expect.objectContaining({ userId: "driver-1" })
    );
  });
});
