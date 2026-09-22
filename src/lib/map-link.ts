/**
 * Pulls a coordinate pair out of a link someone pasted because the search box
 * and the map pin did not find their place — a share link from Google Maps,
 * Apple Maps, OpenStreetMap, Bing Maps or Waze, or just "lat,lng" typed by
 * hand. Pure and isomorphic: no `fetch`, so it runs the same in the browser
 * (an instant check before any network call) and on the server, against
 * whatever URL a short link like `maps.app.goo.gl` redirected to
 * (`map-link.service.ts`).
 *
 * A short link itself carries no coordinates in its own URL — resolving one is
 * the server's job, not this function's.
 */

interface LatLng {
  lat: number;
  lng: number;
}

const isPlausible = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

const LAT = String.raw`(?<lat>-?\d{1,2}\.\d+)`;
const LNG = String.raw`(?<lng>-?\d{1,3}\.\d+)`;

/** Named groups throughout, so a param order that puts lng before lat (OSM's
 * `mlon`/`mlat`) is just another pattern rather than a positional special
 * case — swapping two patterns' group order used to also require remembering
 * to swap how the caller read them. First match wins, tried in this order. */
const PATTERNS: RegExp[] = [
  // Google Maps: .../@48.8584,2.2945,17z
  new RegExp(String.raw`@${LAT},${LNG}`),
  // Google Maps place data blob: ...!3d48.8584!4d2.2945
  new RegExp(String.raw`!3d${LAT}!4d${LNG}`),
  // Google/Bing/Waze "q" or "destination" param: ?q=48.8584,2.2945
  new RegExp(String.raw`[?&](?:q|destination|query)=${LAT},${LNG}`),
  // Apple Maps / OpenStreetMap "ll" param: ?ll=48.8584,2.2945
  new RegExp(String.raw`[?&]ll=${LAT},${LNG}`),
  // OpenStreetMap permalink: #map=17/48.8584/2.2945
  new RegExp(String.raw`#map=\d+\/${LAT}\/${LNG}`),
  // OpenStreetMap marker params, either order: mlat=..&mlon=..
  new RegExp(String.raw`[?&]mlat=${LAT}[^#]*[?&]mlon=${LNG}`),
  new RegExp(String.raw`[?&]mlon=${LNG}[^#]*[?&]mlat=${LAT}`),
  // Bing Maps: cp=48.8584~2.2945
  new RegExp(String.raw`[?&]cp=${LAT}~${LNG}`),
];

/** A bare "48.8584, 2.2945" with nothing else around it — the decimal part is
 * optional here, unlike the patterns above, since a whole-degree pair typed
 * by hand ("49, 2") is still an unambiguous coordinate on its own line. */
const PLAIN_PAIR = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseCoordinatesFromMapLink(input: string): LatLng | null {
  const text = input.trim();
  if (!text) return null;

  const plainMatch = text.match(PLAIN_PAIR);
  if (plainMatch) {
    const lat = Number(plainMatch[1]);
    const lng = Number(plainMatch[2]);
    if (isPlausible(lat, lng)) return { lat, lng };
  }

  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (!match?.groups) continue;

    const lat = Number(match.groups.lat);
    const lng = Number(match.groups.lng);
    if (isPlausible(lat, lng)) return { lat, lng };
  }

  return null;
}

/** Hosts this app will ask the server to follow a redirect on. Anything else
 * is refused before a request ever leaves the server (`map-link.service.ts`) —
 * fetching an arbitrary URL a user pasted is an SSRF surface otherwise. */
export const ALLOWED_MAP_LINK_HOSTS = [
  "maps.google.com",
  "www.google.com",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "maps.apple.com",
  "openstreetmap.org",
  "www.openstreetmap.org",
  "osm.org",
  "www.bing.com",
  "bing.com",
  "waze.com",
  "www.waze.com",
];

export function isAllowedMapLinkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_MAP_LINK_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}
