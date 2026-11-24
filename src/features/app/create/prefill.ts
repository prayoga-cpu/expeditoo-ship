import { parisDay, statedDay } from "./assistant-dates";
import { defaultTimingState, type TimingState } from "./timing";
import { timingFromDraft } from "./assistant";

/**
 * `/create?title=&from=&to=&date=` — what the landing page's search card
 * carries into a new request (docs/specs/landing_2026_11_spec.md §5).
 *
 * The values arrive in a link anyone can write, so each is checked and capped
 * here, once, on the server, before it reaches the form or the sign-in
 * round trip. A value that fails is dropped, never repaired: the form starts
 * blank in that field, exactly as without a prefill. Nothing here is
 * validated *as a request* — the values land as if they had been typed, and
 * each step's own rules read them on « Suivant ».
 */

/** The form's own title limit (`jobFormSchema.title`). */
export const PREFILL_TITLE_MAX = 120;
/** Longer than any town's name; beyond it the value is not a town. */
export const PREFILL_TOWN_MAX = 80;

export interface RequestPrefill {
  title?: string;
  /** A town at the pickup end. No postal code, no pin. */
  from?: string;
  /** A town at the delivery end. */
  to?: string;
  /** `YYYY-MM-DD`, today in France or later, within a year. */
  date?: string;
}

export const PREFILL_KEYS = ["title", "from", "to", "date"] as const;

type QueryValue = string | string[] | undefined;

/** A town's name: letters in any script, digits (« Paris 9e »), and punctuation towns use. */
const TOWN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’.,()/-]*$/u;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/** One value of a query parameter, trimmed, its inner whitespace folded. */
function single(value: QueryValue): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

/** The title, cut to the form's limit: it is still the person's own words. */
function title(value: QueryValue): string | undefined {
  const text = single(value);
  if (!text) return undefined;
  return Array.from(text).slice(0, PREFILL_TITLE_MAX).join("").trim();
}

/** A town, or nothing: a truncated town would name somewhere else. */
function town(value: QueryValue): string | undefined {
  const text = single(value);
  if (!text || Array.from(text).length > PREFILL_TOWN_MAX) return undefined;
  return TOWN.test(text) ? text : undefined;
}

/**
 * The prefill a query string carries, or `null` when it carries none worth
 * using. `now` decides which days are still ahead — in France, where the
 * requests are, the rule the request assistant's dates follow.
 */
export function parseRequestPrefill(
  query: Record<string, QueryValue>,
  now: Date
): RequestPrefill | null {
  const prefill: RequestPrefill = {
    title: title(query.title),
    from: town(query.from),
    to: town(query.to),
    date: statedDay(single(query.date) || null, parisDay(now)) ?? undefined,
  };
  const kept = Object.fromEntries(
    Object.entries(prefill).filter(([, value]) => value !== undefined)
  ) as RequestPrefill;
  return Object.keys(kept).length > 0 ? kept : null;
}

/** The prefill back as query parameters — for the sign-in round trip. */
export function prefillQuery(prefill: RequestPrefill | null): Record<string, string> {
  if (!prefill) return {};
  return Object.fromEntries(
    PREFILL_KEYS.flatMap((key) => (prefill[key] ? [[key, prefill[key]]] : []))
  );
}

/**
 * The When step a prefilled date opens on: that day as a one-day flexible
 * range, the delivery the day after — the request assistant's rule
 * (`timingFromDraft`). No date, no change from the form's own default.
 */
export function prefillTiming(prefill: RequestPrefill | undefined): TimingState {
  const base = defaultTimingState();
  if (!prefill?.date) return base;
  return timingFromDraft(base, { pickupDate: prefill.date, deliveryDate: null }) ?? base;
}
