/**
 * The countries a request can collect from or deliver to, and what each one
 * means for an address: its postal code format, roughly where it is, and its
 * name (client_feedback_2026_10_31_spec.md §6, postal_codes_abroad_spec.md §5).
 *
 * Every ISO 3166-1 country and territory can be chosen (the client, 19
 * November: « need to add all territories and countries of the world »), in
 * two tiers:
 *
 * - **Detailed** — `FREQUENT_COUNTRIES`, the fourteen the form offered before.
 *   Each has a postal code pattern with an example, a box and a map centre.
 *   Adding one is a row in `RULES` and nothing else.
 * - **Generic** — everywhere else. The postal code is optional (some countries
 *   have none) and loosely shaped when given; there is no box to check a pin
 *   against and none to hold the map to.
 *
 * A generic or unknown code is never held to France's pattern or box: only an
 * *absent* country means France.
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

/** A country with a rule of its own: the fourteen the form offers first. */
export type DetailedCountry = keyof typeof RULES;

/** France first, then by proximity — the « Pays fréquents » group. */
export const FREQUENT_COUNTRIES = [
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
] as const satisfies readonly DetailedCountry[];

/**
 * Every officially assigned ISO 3166-1 alpha-2 code — countries and
 * territories alike (Réunion and Guadeloupe have their own). Static because
 * `Intl.supportedValuesOf` lists no regions; names come from `Intl.DisplayNames`.
 */
// prettier-ignore
export const JOB_COUNTRIES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW",
  "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
  "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;

export type JobCountry = (typeof JOB_COUNTRIES)[number];

export const DEFAULT_COUNTRY: JobCountry = "FR";

const KNOWN: ReadonlySet<string> = new Set(JOB_COUNTRIES);

/** Whether `code` is a country or territory a request can name. */
export function isJobCountry(code: string | null | undefined): code is JobCountry {
  return code != null && KNOWN.has(code);
}

/** Whether the country has a rule of its own — a pattern, a box, a centre. */
export function isDetailedCountry(
  code: string | null | undefined
): code is DetailedCountry {
  return code != null && Object.prototype.hasOwnProperty.call(RULES, code);
}

/**
 * The country's own rule, or null for a generic one. Only an absent country
 * is France (every caller before 2.76.0, and escalation's pickup); a code
 * with no rule — « US », or one nobody assigned — has none, and is never
 * lent France's.
 */
function rule(code: string | null | undefined): CountryRule | null {
  const country = code || DEFAULT_COUNTRY;
  return isDetailedCountry(country) ? RULES[country] : null;
}

/**
 * A postal code where the country's own shape is not known: two to twelve
 * letters, digits, spaces or dashes, with a letter or digit at each end —
 * « SW1A 1AA », « 10001 », « K1A 0B1 », « 100-0001 ».
 */
const GENERIC_POSTAL_CODE = /^[A-Za-z0-9][A-Za-z0-9 -]{0,10}[A-Za-z0-9]$/;

/**
 * Whether the country's addresses must carry a postal code. Only where its
 * format is known: elsewhere it may not exist at all (Hong Kong, the UAE,
 * much of Africa), so it cannot be demanded.
 */
export function isPostalCodeRequired(country: string | null | undefined): boolean {
  return rule(country) !== null;
}

/**
 * Whether `value` is written the way the country writes a postal code. A
 * generic country accepts none at all, or anything shaped like one.
 */
export function isValidPostalCode(country: string | null | undefined, value: string): boolean {
  const own = rule(country);
  const code = value.trim();
  if (own) return own.postalCode.test(code);
  return code === "" || GENERIC_POSTAL_CODE.test(code);
}

/** The shape to show as a hint, or null where the country's is not known. */
export function postalCodeExample(country: string | null | undefined): string | null {
  return rule(country)?.example ?? null;
}

/** Within the country's box. A country without one refuses no pin. */
export function isInCountry(country: string | null | undefined, lat: number, lng: number): boolean {
  const own = rule(country);
  if (!own) return true;
  const { box } = own;
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

/**
 * The box as MapLibre's `maxBounds` — `[[west, south], [east, north]]`,
 * padded — or undefined where there is no box to hold the map to.
 */
export function countryMapBounds(
  country: string | null | undefined
): [[number, number], [number, number]] | undefined {
  const own = rule(country);
  if (!own) return undefined;
  const { box } = own;
  const pad = 0.5;
  return [
    [box.minLng - pad, box.minLat - pad],
    [box.maxLng + pad, box.maxLat + pad],
  ];
}

/** The whole world: where the map opens before a generic country is found. */
export const WORLD_VIEW = { latitude: 25, longitude: 10, zoom: 1 };

export function countryMapCenter(country: string | null | undefined) {
  return rule(country)?.center ?? WORLD_VIEW;
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

/**
 * Territories the map service (Nominatim) files under the state they belong
 * to: `countrycodes=re` finds nothing, and a pin on Réunion reverse-geocodes
 * as « fr ». Read from the service itself, code by code, on 2026-11-22 — it is
 * a fact about the geocoder's data, not a statement about any territory.
 */
const GEOCODER_PARENT: Partial<Record<JobCountry, JobCountry>> = {
  BL: "FR", GF: "FR", GP: "FR", MF: "FR", MQ: "FR", NC: "FR", PF: "FR", PM: "FR",
  RE: "FR", TF: "FR", WF: "FR", YT: "FR",
  AS: "US", GU: "US", MP: "US", PR: "US", UM: "US", VI: "US",
  AW: "NL", BQ: "NL", CW: "NL", SX: "NL",
  CC: "AU", CX: "AU", HM: "AU", NF: "AU",
  HK: "CN", MO: "CN",
  BV: "NO", SJ: "NO",
  AX: "FI",
  EH: "MA",
};

/**
 * How to ask the map service about a country: the `countrycodes` it files the
 * country under and, for a territory filed under its state, the territory's
 * name to add to what is searched — « Saint-Denis » in France is a suburb of
 * Paris, « Saint-Denis, Réunion » is the one meant. A reverse-geocoded pin is
 * in the country when its code is `countrycodes`.
 */
export function geocoderScope(
  code: string,
  locale: string
): { countrycodes: string; suffix: string | null } {
  const parent = isJobCountry(code) ? GEOCODER_PARENT[code] : undefined;
  return parent
    ? { countrycodes: parent.toLowerCase(), suffix: countryName(code, locale) }
    : { countrycodes: code.toLowerCase(), suffix: null };
}

export interface CountryOption {
  code: JobCountry;
  name: string;
}

/**
 * What the country picker lists, named in `locale`: the frequent fourteen in
 * their own order, then every country and territory by name — the frequent
 * ones included, so « Tous les pays » is all of them.
 */
export function countryOptions(locale: string): {
  frequent: CountryOption[];
  all: CountryOption[];
} {
  const option = (code: JobCountry) => ({ code, name: countryName(code, locale) });
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return {
    frequent: FREQUENT_COUNTRIES.map(option),
    all: JOB_COUNTRIES.map(option).sort((a, b) => collator.compare(a.name, b.name)),
  };
}

/** A name as compared: accents, case and punctuation aside. */
export function countryNameKey(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/**
 * What people type that the runtime's French and English names do not cover:
 * native names, abbreviations, old names and the parts of a country.
 */
const ALIASES: Record<string, JobCountry> = {
  fra: "FR",
  "republique francaise": "FR",
  belgie: "BE",
  belgien: "BE",
  luxemburg: "LU",
  "the netherlands": "NL",
  nederland: "NL",
  hollande: "NL",
  holland: "NL",
  deutschland: "DE",
  schweiz: "CH",
  svizzera: "CH",
  osterreich: "AT",
  italia: "IT",
  espana: "ES",
  polska: "PL",
  "republique tcheque": "CZ",
  "czech republic": "CZ",
  cesko: "CZ",
  uk: "GB",
  "u k": "GB",
  angleterre: "GB",
  england: "GB",
  ecosse: "GB",
  scotland: "GB",
  "pays de galles": "GB",
  wales: "GB",
  "irlande du nord": "GB",
  "northern ireland": "GB",
  "grande bretagne": "GB",
  "great britain": "GB",
  usa: "US",
  "u s a": "US",
  "united states of america": "US",
  "etats unis d amerique": "US",
  uae: "AE",
  emirats: "AE",
  "hong kong": "HK",
  macao: "MO",
  macau: "MO",
  reunion: "RE",
  "ile de la reunion": "RE",
  birmanie: "MM",
  burma: "MM",
  "ivory coast": "CI",
  "porto rico": "PR",
  "puerto rico": "PR",
  russia: "RU",
  russie: "RU",
  "south korea": "KR",
  "coree du sud": "KR",
  turkey: "TR",
  turquie: "TR",
  vatican: "VA",
  palestine: "PS",
};

let namesTable: Map<string, JobCountry> | null = null;

/**
 * Every country's French and English name to its code, read once from the
 * runtime's own table, with the aliases over them. French first: where the
 * two languages give one spelling to two places, a French reader is believed.
 */
function countryNames(): Map<string, JobCountry> {
  if (namesTable) return namesTable;
  const table = new Map<string, JobCountry>();
  for (const locale of ["fr", "en"]) {
    for (const code of JOB_COUNTRIES) {
      const key = countryNameKey(countryName(code, locale));
      if (key.length > 2 && !table.has(key)) table.set(key, code);
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) table.set(alias, code);
  namesTable = table;
  return table;
}

/**
 * The ISO code a free-typed country stands for — its name in French or
 * English, an alias, or the code itself — or null when it says nothing
 * recognisable (« non précisé », blank, two letters nobody assigned).
 */
export function countryCodeFrom(text: string | null | undefined): JobCountry | null {
  const key = countryNameKey(text);
  if (!key) return null;
  const named = countryNames().get(key);
  if (named) return named;
  const code = key.toUpperCase();
  return isJobCountry(code) ? code : null;
}
