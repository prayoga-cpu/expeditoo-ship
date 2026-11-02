import { parseDecimal } from "@/lib/numeric-input";
import {
  resolveDimensions,
  resolveWeightKg,
  type SizeMode,
  type SizePresetId,
  type WeightBracketId,
} from "./cargo";

/**
 * « Prix conseillé » on the Budget step (client_feedback_2026_10_29_spec.md
 * §B6): the platform's own rate card — the engine that prices Expedion quotes
 * (`pricingService`, through `POST /api/pricing/calculate`) — read as a range
 * rather than a figure, because it is advice to the requester, not a quote.
 *
 * The engine prices parcels: up to 100 kg and 300 cm a side. Anything bigger
 * gets no suggestion rather than an invented one, and neither does a move,
 * which has no rate yet. Several items are priced parcel by parcel — the
 * engine's price times the quantity — as a parcel carrier prices a
 * consignment (client_feedback_2026_10_31_spec.md §0 G).
 */

export const SUGGESTION_SPREAD = 0.15;
const ROUND_TO_CENTS = 500;
const ENGINE_MAX_KG = 100;
const ENGINE_MAX_CM = 300;

/** One end as the estimate reads it: its pin, or what to find it from. */
export interface SuggestionEnd {
  lat?: number;
  lng?: number;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export interface SuggestionInput {
  pickup: SuggestionEnd;
  dropoff: SuggestionEnd;
  jobKind?: "items" | "moving";
  quantity?: string | number;
  weightBracket?: WeightBracketId;
  exactWeightKg?: string | number;
  sizeMode?: SizeMode;
  sizePreset?: SizePresetId;
  lengthCm?: string | number;
  widthCm?: string | number;
  heightCm?: string | number;
}

export type Parcel = PricingRequest["package"];

export interface PricingRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  package: { length: number; width: number; height: number; weight: number };
  speed: "STANDARD";
}

const num = (v: string | number | undefined) =>
  typeof v === "number" ? v : v ? (parseDecimal(v) ?? undefined) : undefined;

/**
 * One item as the engine reads it, or null when the engine cannot price it
 * honestly: a move, no weight, no size, or beyond a parcel.
 */
export function parcelFor(input: SuggestionInput): Parcel | null {
  if (input.jobKind === "moving") return null;
  if (!input.weightBracket) return null;

  const weight = resolveWeightKg(input.weightBracket, num(input.exactWeightKg));
  const dims = resolveDimensions(input.sizeMode ?? "preset", input.sizePreset, {
    lengthCm: num(input.lengthCm),
    widthCm: num(input.widthCm),
    heightCm: num(input.heightCm),
  });
  const { lengthCm, widthCm, heightCm } = dims;
  if (!weight || !lengthCm || !widthCm || !heightCm) return null;
  if (weight > ENGINE_MAX_KG) return null;
  if (Math.max(lengthCm, widthCm, heightCm) > ENGINE_MAX_CM) return null;

  return { length: lengthCm, width: widthCm, height: heightCm, weight };
}

/** How many items the price covers: at least one, whole. */
export function itemCount(input: SuggestionInput): number {
  const count = num(input.quantity);
  return count && count >= 1 ? Math.floor(count) : 1;
}

/** What to ask the engine for one item, or null when it cannot be asked honestly. */
export function suggestionRequest(input: SuggestionInput): PricingRequest | null {
  const { pickup, dropoff } = input;
  if (pickup.lat == null || pickup.lng == null) return null;
  if (dropoff.lat == null || dropoff.lng == null) return null;
  const parcel = parcelFor(input);
  if (!parcel) return null;

  return {
    origin: { lat: pickup.lat, lng: pickup.lng },
    destination: { lat: dropoff.lat, lng: dropoff.lng },
    package: parcel,
    speed: "STANDARD",
  };
}

/**
 * Whether an end without a pin can still be found for the estimate: a town,
 * or a postal code, to look up.
 */
export function canLocate(end: SuggestionEnd): boolean {
  if (end.lat != null && end.lng != null) return true;
  return Boolean(end.city?.trim() || end.postalCode?.trim());
}

const roundTo = (cents: number) =>
  Math.max(ROUND_TO_CENTS, Math.round(cents / ROUND_TO_CENTS) * ROUND_TO_CENTS);

/** The engine's figure, ±15 %, to the nearest 5 €. */
export function suggestedRange(totalEuros: number): { lowCents: number; highCents: number } {
  const cents = totalEuros * 100;
  return {
    lowCents: roundTo(cents * (1 - SUGGESTION_SPREAD)),
    highCents: roundTo(cents * (1 + SUGGESTION_SPREAD)),
  };
}
