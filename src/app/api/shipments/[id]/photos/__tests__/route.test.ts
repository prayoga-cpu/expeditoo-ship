import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The route's own job: refuse before anything is read, and turn a multipart
 * body into a validated capture. The service is mocked — what it does with a
 * valid call is `shipment-photos.service.test.ts`'s subject.
 */

vi.mock("@/server/services/viewer.service", () => ({
  resolveViewer: vi.fn(),
}));
vi.mock("@/server/services/shipment-photos.service", () => ({
  shipmentPhotosService: { capture: vi.fn(), list: vi.fn() },
}));

import { GET, POST } from "../route";
import { resolveViewer } from "@/server/services/viewer.service";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";

const DRIVER = { userId: "driver-1" };
const PARAMS = { params: Promise.resolve({ id: "ship-1" }) };

function multipart(fields: Record<string, string | Blob>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return new Request("http://localhost/api/shipments/ship-1/photos", {
    method: "POST",
    body,
  });
}

const IMAGE = new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
  type: "image/jpeg",
});

const VALID = {
  file: IMAGE,
  stage: "pickup",
  lat: "48.86919",
  lng: "2.33144",
  accuracyM: "8",
  capturedAt: "2026-08-29T12:32:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveViewer).mockResolvedValue(DRIVER as never);
  vi.mocked(shipmentPhotosService.capture).mockResolvedValue({
    id: "photo-1",
  } as never);
});

describe("POST /api/shipments/:id/photos", () => {
  it("refuses an unauthenticated caller, and stores nothing", async () => {
    vi.mocked(resolveViewer).mockResolvedValue(null);

    const response = await POST(multipart(VALID), PARAMS);

    expect(response.status).toBe(401);
    // Checking this and not only the status: a 401 that had already stored the
    // object would still be an anonymous write.
    expect(shipmentPhotosService.capture).not.toHaveBeenCalled();
  });

  it("refuses a body with no file", async () => {
    const { file: _file, ...withoutFile } = VALID;
    void _file;

    const response = await POST(multipart(withoutFile), PARAMS);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("NO_FILE");
    expect(shipmentPhotosService.capture).not.toHaveBeenCalled();
  });

  it.each([
    ["blank coordinates, which coerce to a valid 0,0", { lat: "", lng: "" }],
    ["a blank capture time, which would coerce to the epoch", { capturedAt: "" }],
    ["a latitude past the pole", { lat: "91" }],
    ["a longitude off the globe", { lng: "181" }],
    ["an unparseable capture time", { capturedAt: "not-a-date" }],
  ])("refuses %s with LOCATION_REQUIRED", async (_label, override) => {
    const response = await POST(multipart({ ...VALID, ...override }), PARAMS);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("LOCATION_REQUIRED");
    expect(shipmentPhotosService.capture).not.toHaveBeenCalled();
  });

  it("passes the parsed fix and the bytes through together", async () => {
    const response = await POST(multipart(VALID), PARAMS);

    expect(response.status).toBe(201);
    const [shipmentId, input, file] = vi.mocked(shipmentPhotosService.capture)
      .mock.calls[0];
    expect(shipmentId).toBe("ship-1");
    expect(input).toMatchObject({
      stage: "pickup",
      lat: 48.86919,
      lng: 2.33144,
      accuracyM: 8,
    });
    expect(input.capturedAt).toBeInstanceOf(Date);
    expect(file.mimeType).toBe("image/jpeg");
    expect(file.buffer.length).toBe(3);
  });

  it.each([
    ["omitted", undefined],
    ["present but blank", ""],
  ])("treats a %s accuracy as absent, never as ±0 m", async (_label, value) => {
    const { accuracyM: _dropped, ...rest } = VALID;
    void _dropped;
    const fields = value === undefined ? rest : { ...rest, accuracyM: value };

    await POST(multipart(fields), PARAMS);

    const [, input] = vi.mocked(shipmentPhotosService.capture).mock.calls[0];
    expect(input.accuracyM).toBeUndefined();
  });
});

describe("GET /api/shipments/:id/photos", () => {
  it("refuses an unauthenticated caller", async () => {
    vi.mocked(resolveViewer).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), PARAMS);

    expect(response.status).toBe(401);
    expect(shipmentPhotosService.list).not.toHaveBeenCalled();
  });

  it("hands back both groups", async () => {
    vi.mocked(shipmentPhotosService.list).mockResolvedValue({
      pickup: [],
      delivery: [],
    } as never);

    const response = await GET(new Request("http://localhost"), PARAMS);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ pickup: [], delivery: [] });
  });
});
