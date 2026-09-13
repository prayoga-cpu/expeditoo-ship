import { describe, it, expect, vi, beforeEach } from "vitest";

import { GET } from "../route";
import { storageService } from "@/server/services/storage.service";
import { StorageError } from "@/server/services/storage/storage-error";

/**
 * Covers docs/specs/public_images_spec.md §3.
 *
 * Every public upload used to produce a URL on `cdn.prayoga.io`, a hostname
 * with no DNS record, so every preview in the app was a broken image. This
 * route is what those URLs now point at.
 */

vi.mock("@/server/services/storage.service", () => ({
  storageService: { readImage: vi.fn() },
}));

const readImage = vi.mocked(storageService.readImage);

const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50]);

function streamOf(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

const call = (...key: string[]) =>
  GET(new Request(`http://localhost/api/images/${key.join("/")}`), {
    params: Promise.resolve({ key }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  readImage.mockResolvedValue({
    body: streamOf(WEBP),
    contentType: "image/webp",
    contentLength: WEBP.byteLength,
  });
});

describe("GET /api/images/[...key]", () => {
  it("streams the stored bytes with the stored type", async () => {
    const res = await call("user-1", "abc123.webp");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Content-Length")).toBe(String(WEBP.byteLength));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(WEBP);
  });

  it("asks storage for the whole key, segments rejoined", async () => {
    await call("rJOnod4H9WUM1lFg0rYZt5kxOxeQc63z", "ah9KLaKpUBq9vD78vVNsD.webp");

    expect(readImage).toHaveBeenCalledWith(
      "rJOnod4H9WUM1lFg0rYZt5kxOxeQc63z/ah9KLaKpUBq9vD78vVNsD.webp"
    );
  });

  it("lets the edge keep it forever, because a key never changes content", async () => {
    const res = await call("user-1", "abc123.webp");

    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=31536000");
  });

  it("tells the browser not to second-guess the type, and sandboxes the response", async () => {
    const res = await call("user-1", "abc123.webp");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("answers 404 in the standard envelope when there is no such image", async () => {
    readImage.mockRejectedValue(new StorageError("IMAGE_NOT_FOUND", 404, "Image not found"));

    const res = await call("user-1", "missing.webp");

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      success: false,
      error: { code: "IMAGE_NOT_FOUND" },
    });
  });

  it("answers 400 for a key storage refuses to look up", async () => {
    readImage.mockRejectedValue(new StorageError("INVALID_IMAGE_KEY", 400));

    const res = await call("..", "secret");

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "INVALID_IMAGE_KEY" } });
  });
});
