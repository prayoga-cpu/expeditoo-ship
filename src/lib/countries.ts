/**
 * The countries a request can collect from or deliver to, and what each one
 * means for an address: its postal code format, roughly where it is, and its
 * name (client_feedback_2026_10_31_spec.md §6).
 *
 * The list is the countries Expedion quotes already deliver to that a van can
 * reach from France without a customs border (spec §0 A). Adding one is a row
 * here — its pattern, its box, its centre — and nothing else.
 *
 * A box is a sanity check, as the France box it replaces was: it catches a pin
 * dropped in the wrong country, not one a few kilometres over a border.
 */

interface CountryRule {
  /** The postal code as people write it. */
  postalCode: RegExp;
  /** Shown in the refusal, so the person sees the shape that is wanted. */
  example: string;
  box: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  /** Where the map opens, and how close. */
  center: { latitude: number; longitude: number; zoom: number };
}

const RULES = {
  FR: {
    postalCode: /^\d{5}$/,
    example: "75011",
    // Metropolitan France plus Corsica — the box `listings.dto.ts` always used.
    box: { minLat: 41.3, maxLat: 51.2, minLng: -5.2, maxLng: 9.7 },
    center: { latitude: 48.8566, longitude: 2.3522, zoom: 5 },
  },
  MC: {
    postalCode: /^980\d{2}$/,
    example: "98000",
    box: { minLat: 43.7, maxLat: 43.78, minLng: 7.38, maxLng: 7.46 },
    center: { latitude: 43.7384, longitude: 7.4246, zoom: 13 },
  },
  BE: {
    postalCode: /^\d{4}$/,
    example: "1000",
    box: { minLat: 49.45, maxLat: 51.55, minLng: 2.5, maxLng: 6.45 },
    center: { latitude: 50.8503, longitude: 4.3517, zoom: 7 },
  },
  LU: {
    postalCode: /^\d{4}$/,
    example: "1009",
    box: { minLat: 49.4, maxLat: 50.22, minLng: 5.7, maxLng: 6.56 },
    center: { latitude: 49.6116, longitude: 6.1319, zoom: 9 },
  },
  NL: {
    postalCode: /^\d{4} ?[A-Za-z]{2}$/,
    example: "1012 AB",
    box: { minLat: 50.7, maxLat: 53.6, minLng: 3.3, maxLng: 7.25 },
    center: { latitude: 52.3676, longitude: 4.9041, zoom: 7 },
  },
  DE: {
    postalCode: /^\d{5}$/,
    example: "10115",
    box: { minLat: 47.25, maxLat: 55.1, minLng: 5.85, maxLng: 15.1 },
    center: { latitude: 51.1657, longitude: 10.4515, zoom: 5 },
  },
  CH: {
    postalCode: /^\d{4}$/,
    example: "8001",
    box: { minLat: 45.8, maxLat: 47.85, minLng: 5.9, maxLng: 10.55 },
    center: { latitude: 46.8182, longitude: 8.2275, zoom: 7 },
  },
  AT: {
    postalCode: /^\d{4}$/,
    example: "1010",
    box: { minLat: 46.35, maxLat: 49.05, minLng: 9.5, maxLng: 17.2 },
    center: { latitude: 47.5162, longitude: 14.5501, zoom: 6 },
  },
  IT: {
    postalCode: /^\d{5}$/,
    example: "00184",
    box: { minLat: 35.45, maxLat: 47.1, minLng: 6.6, maxLng: 18.55 },
    center: { latitude: 41.9028, longitude: 12.4964, zoom: 5 },
  },
  ES: {
    postalCode: /^\d{5}$/,
    example: "28013",
    // The Balearics and the Canaries included.
    box: { minLat: 27.6, maxLat: 43.8, minLng: -18.2, maxLng: 4.35 },
    center: { latitude: 40.4168, longitude: -3.7038, zoom: 5 },
  },
  PT: {
    postalCode: /^\d{4}-\d{3}$/,
    example: "1100-148",
    // Madeira and the Azores included.
    box: { minLat: 32.6, maxLat: 42.2, minLng: -31.3, maxLng: -6.15 },
    center: { latitude: 39.6, longitude: -8.0, zoom: 6 },
  },
  PL: {
    postalCode: /^\d{2}-\d{3}$/,
    example: "00-950",
    box: { minLat: 49.0, maxLat: 54.85, minLng: 14.1, maxLng: 24.15 },
    center: { latitude: 52.2297, longitude: 21.0122, zoom: 5 },
  },
  CZ: {
    postalCode: /^\d{3} ?\d{2}$/,
    example: "110 00",
    box: { minLat: 48.55, maxLat: 51.06, minLng: 12.09, maxLng: 18.86 },
    center: { latitude: 50.0755, longitude: 14.4378, zoom: 6 },
  },
  RO: {
    postalCode: /^\d{6}$/,
    example: "010011",
    box: { minLat: 43.6, maxLat: 48.3, minLng: 20.25, maxLng: 29.75 },
    center: { latitude: 44.4268, longitude: 26.1025, zoom: 6 },
  },
} as const satisfies Record<string, CountryRule>;

export type JobCountry = keyof typeof RULES;

/** In the order the form offers them: France first, then by proximity. */
export const JOB_COUNTRIES = [
  "FR",
  "MC",
  "BE",
  "LU",
  "NL",
  "DE",
  "CH",
  "AT",
  "IT",
  "ES",
  "PT",
  "PL",
  "CZ",
  "RO",
] as const satisfies readonly JobCountry[];

export const DEFAULT_COUNTRY: JobCountry = "FR";

export function isJobCountry(code: string | null | undefined): code is JobCountry {
  return code != null && Object.prototype.hasOwnProperty.call(RULES, code);
}

function rule(code: string | null | undefined): CountryRule {
  return isJobCountry(code) ? RULES[code] : RULES[DEFAULT_COUNTRY];
}

/** Whether `value` is written the way the country writes a postal code. */
export function isValidPostalCode(country: string | null | undefined, value: string): boolean {
  return rule(country).postalCode.test(value.trim());
}

export function postalCodeExample(country: string | null | undefined): string {
  return rule(country).example;
}

/** Within the country's box. An unknown country is held to France's. */
export function isInCountry(country: string | null | undefined, lat: number, lng: number): boolean {
  const { box } = rule(country);
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

/** The box as MapLibre's `maxBounds` — `[[west, south], [east, north]]`, padded. */
export function countryMapBounds(
  country: string | null | undefined
): [[number, number], [number, number]] {
  const { box } = rule(country);
  const pad = 0.5;
  return [
    [box.minLng - pad, box.minLat - pad],
    [box.maxLng + pad, box.maxLat + pad],
  ];
}

export function countryMapCenter(country: string | null | undefined) {
  return rule(country).center;
}

/**
 * The country's name in `locale`, from the runtime's own table — no copy to
 * keep in step. Falls back to the code where the runtime has no table.
 */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Names as people type them — French, English and native — to an ISO code. */
const NAMES: Record<string, string> = {
  fra: "FR",
  france: "FR",
  "republique francaise": "FR",
  monaco: "MC",
  belgique: "BE",
  belgium: "BE",
  belgie: "BE",
  belgien: "BE",
  luxembourg: "LU",
  luxemburg: "LU",
  "pays bas": "NL",
  netherlands: "NL",
  "the netherlands": "NL",
  nederland: "NL",
  hollande: "NL",
  holland: "NL",
  allemagne: "DE",
  germany: "DE",
  deutschland: "DE",
  suisse: "CH",
  switzerland: "CH",
  schweiz: "CH",
  svizzera: "CH",
  autriche: "AT",
  austria: "AT",
  osterreich: "AT",
  italie: "IT",
  italy: "IT",
  italia: "IT",
  espagne: "ES",
  spain: "ES",
  espana: "ES",
  portugal: "PT",
  pologne: "PL",
  poland: "PL",
  polska: "PL",
  "republique tcheque": "CZ",
  tchequie: "CZ",
  "czech republic": "CZ",
  czechia: "CZ",
  cesko: "CZ",
  roumanie: "RO",
  romania: "RO",
  // Not offered on `/create`, but Expedion quotes deliver there, and an
  // escalated job should say where rather than claim France.
  uk: "GB",
  "royaume uni": "GB",
  "united kingdom": "GB",
  angleterre: "GB",
  england: "GB",
  "grande bretagne": "GB",
  "great britain": "GB",
  irlande: "IE",
  ireland: "IE",
  usa: "US",
  "etats unis": "US",
  "united states": "US",
  "united states of america": "US",
  "etats unis d amerique": "US",
  bulgarie: "BG",
  bulgaria: "BG",
  chine: "CN",
  china: "CN",
  "porto rico": "PR",
  "puerto rico": "PR",
};

/**
 * The ISO code a free-typed country stands for, or null when it says nothing
 * recognisable (« non précisé », blank). Two letters are read as a code.
 */
export function countryCodeFrom(text: string | null | undefined): string | null {
  const key = (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
  if (!key) return null;
  if (NAMES[key]) return NAMES[key];
  return /^[a-z]{2}$/.test(key) ? key.toUpperCase() : null;
}
