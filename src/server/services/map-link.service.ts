import {
  isAllowedMapLinkHost,
  parseCoordinatesFromMapLink,
} from "@/lib/map-link";

export class MapLinkError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "MapLinkError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new MapLinkError(code, status, message);

const FETCH_TIMEOUT_MS = 5000;

/**
 * Resolves a map-provider link to a coordinate pair, for the person who could
 * not find their address on the picker's search or pin.
 *
 * A full link (one already carrying `@lat,lng`, `?ll=`, ...) is parsed on the
 * client with no round trip. This only exists for what the client cannot do
 * itself: a *short* share link (`maps.app.goo.gl/...`) carries no coordinates
 * of its own — they only appear after the redirect — and a browser fetch
 * cannot follow that redirect cross-origin. The allowlist matters because this
 * is otherwise a server fetching whatever URL a user pasted: an SSRF surface
 * if it accepted any host.
 */
export const mapLinkService = {
  async resolve(rawUrl: string): Promise<{ lat: number; lng: number }> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw err("INVALID_LINK", 422, "Not a valid URL");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw err("UNSUPPORTED_LINK_PROVIDER", 422);
    }
    if (!isAllowedMapLinkHost(url.hostname)) {
      throw err("UNSUPPORTED_LINK_PROVIDER", 422);
    }

    // The coordinates are sometimes already in the link itself even before a
    // redirect (a full google.com/maps/... URL pasted by hand).
    const direct = parseCoordinatesFromMapLink(url.toString());
    if (direct) return direct;

    let finalUrl: string;
    try {
      const res = await fetch(url.toString(), {
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "Expeditoo/1.0" },
      });
      finalUrl = res.url || url.toString();
    } catch {
      throw err("LINK_UNREACHABLE", 422);
    }

    const resolved = parseCoordinatesFromMapLink(finalUrl);
    if (!resolved) throw err("LOCATION_NOT_FOUND_IN_LINK", 422);

    return resolved;
  },
};
