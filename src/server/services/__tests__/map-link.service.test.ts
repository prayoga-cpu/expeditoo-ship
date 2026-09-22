import { afterEach, describe, expect, it, vi } from "vitest";

import { mapLinkService, MapLinkError } from "../map-link.service";

/**
 * `mapLinkService.resolve` is the only piece of this feature that makes a
 * server-side request to a URL a user pasted — everything else
 * (`parseCoordinatesFromMapLink`) is pure. The allowlist is what keeps that
 * fetch from being an SSRF surface, so it is the thing most worth locking
 * down here, alongside the short-link redirect case it exists for.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapLinkService.resolve", () => {
  it("parses coordinates already present in the link, with no fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mapLinkService.resolve(
      "https://www.google.com/maps/place/x/@48.8584,2.2945,17z"
    );

    expect(result).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("follows a short link's redirect and reads the destination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        url: "https://www.google.com/maps/place/x/@48.8584,2.2945,17z",
      })
    );

    const result = await mapLinkService.resolve(
      "https://maps.app.goo.gl/abc123"
    );

    expect(result).toEqual({ lat: 48.8584, lng: 2.2945 });
  });

  it("refuses a host outside the map-provider allowlist, with no fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      mapLinkService.resolve("https://evil.example.com/steal-my-server")
    ).rejects.toMatchObject({ code: "UNSUPPORTED_LINK_PROVIDER", status: 422 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a non-http(s) scheme, with no fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      mapLinkService.resolve("file:///etc/passwd")
    ).rejects.toMatchObject({ code: "UNSUPPORTED_LINK_PROVIDER", status: 422 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects text that is not a URL at all", async () => {
    await expect(mapLinkService.resolve("not a url")).rejects.toMatchObject({
      code: "INVALID_LINK",
      status: 422,
    });
  });

  it("reports a redirect that lands on a page with no coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ url: "https://www.google.com/maps" })
    );

    await expect(
      mapLinkService.resolve("https://maps.app.goo.gl/abc123")
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND_IN_LINK", status: 422 });
  });

  it("reports an unreachable link rather than throwing a raw network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    await expect(
      mapLinkService.resolve("https://maps.app.goo.gl/abc123")
    ).rejects.toMatchObject({ code: "LINK_UNREACHABLE", status: 422 });
  });

  it("is a MapLinkError, so api-response.ts can translate it", async () => {
    try {
      await mapLinkService.resolve("https://evil.example.com");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MapLinkError);
    }
  });
});
