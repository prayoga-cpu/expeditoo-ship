/**
 * The landing page's search card, as data (docs/specs/landing_2026_11_spec.md
 * §2): four values in, one `/create` link out. `/create` reads the same four
 * keys (`parseRequestPrefill`) and checks them again — this side only trims
 * and drops what is empty, so the link stays short and readable.
 */

export interface LandingSearchValues {
  /** « Que transportez-vous ? » — the request's title. */
  title: string;
  /** « Ville de départ » */
  from: string;
  /** « Destination » */
  to: string;
  /** `YYYY-MM-DD` from the date input, or empty. */
  date: string;
}

export const EMPTY_SEARCH: LandingSearchValues = { title: "", from: "", to: "", date: "" };

/** In the order `/create` documents them. */
const KEYS = ["title", "from", "to", "date"] as const;

export function buildCreateUrl(values: Partial<LandingSearchValues>): string {
  const query = new URLSearchParams();
  for (const key of KEYS) {
    const value = values[key]?.replace(/\s+/g, " ").trim();
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `/create?${qs}` : "/create";
}

/**
 * Example trajets that fill the card's two towns. Examples, not a ranking:
 * nothing here claims they are the most requested (no figure backs that).
 * French towns only — a chip that wrote « Bruxelles » would leave the
 * request's country on France.
 */
export const EXAMPLE_ROUTES = [
  { from: "Paris", to: "Lyon" },
  { from: "Lille", to: "Paris" },
  { from: "Marseille", to: "Nice" },
] as const;

/** Matches the `/create` parser's caps (`PREFILL_TITLE_MAX`, `PREFILL_TOWN_MAX`). */
export const SEARCH_TITLE_MAX = 120;
export const SEARCH_TOWN_MAX = 80;
