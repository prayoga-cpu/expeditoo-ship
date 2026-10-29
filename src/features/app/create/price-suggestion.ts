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
 * gets no suggestion rather than an invented one.
 */

export const SUGGESTION_SPREAD = 0.15;
const ROUND_TO_CENTS = 500;
const ENGINE_MAX_KG = 100;
const ENGINE_MAX_CM = 300;

export interface SuggestionInput {
  pickup: { lat?: number; lng?: number };
  dropoff: { lat?: number; lng?: number };
  weightBracket?: WeightBracketId;
  exactWeightKg?: string | number;
  sizeMode?: SizeMode;
  sizePreset?: SizePresetId;
  lengthCm?: string | number;
  widthCm?: string | number;
  heightCm?: string | number;
}

export interface PricingRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  package: { length: number; width: number; height: number; weight: number };
  speed: "STANDARD";
}

const num = (v: string | number | undefined) =>
  typeof v === "number" ? v : v ? (parseDecimal(v) ?? undefined) : undefined;

/** What to ask the engine, or null when it cannot be asked honestly. */
export function suggestionRequest(input: SuggestionInput): PricingRequest | null {
  const { pickup, dropoff } = input;
  if (pickup.lat == null || pickup.lng == null) return null;
  if (dropoff.lat == null || dropoff.lng == null) return null;
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

  return {
    origin: { lat: pickup.lat, lng: pickup.lng },
    destination: { lat: dropoff.lat, lng: dropoff.lng },
    package: { length: lengthCm, width: widthCm, height: heightCm, weight },
    speed: "STANDARD",
  };
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
