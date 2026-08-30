/**
 * "How heavy" and "how big", as a person actually picks them.
 *
 * The database is unchanged: a listing still stores one `weightKg` and three
 * dimensions in centimetres, and nothing downstream learns a new vocabulary. A
 * bracket is an input affordance that **resolves to a number**, and it resolves
 * upward to its ceiling. That direction is load-bearing — `TakeJobPanel` offers
 * a job to a vehicle when `maxWeightKg >= job.weightKg`, so a bracket resolving
 * downward would put a 90 kg load in a van rated for 50.
 *
 * The ids are the source of truth and the metadata is keyed off them with
 * `satisfies`, so a bracket nobody gave a ceiling is a type error rather than an
 * `undefined` weight arriving at the API.
 *
 * See docs/specs/cargo_input_spec.md §3-4.
 */

export const WEIGHT_BRACKET_IDS = [
  "upTo5",
  "upTo30",
  "upTo100",
  "upTo500",
  "upTo1000",
  "over1000",
] as const;

export type WeightBracketId = (typeof WEIGHT_BRACKET_IDS)[number];

/** Above this everything is freight, and freight gets weighed. */
export const HEAVY_BRACKET_MIN_KG = 1000;

/** The one bracket that asks for a figure instead of supplying one. */
export const HEAVY_BRACKET_ID = "over1000" satisfies WeightBracketId;

/** Ceiling in kilograms; `null` means the person states the weight. */
export const WEIGHT_BRACKET_MAX_KG = {
  upTo5: 5,
  upTo30: 30,
  upTo100: 100,
  upTo500: 500,
  upTo1000: HEAVY_BRACKET_MIN_KG,
  over1000: null,
} as const satisfies Record<WeightBracketId, number | null>;

/**
 * The bracket's ceiling, or — for the only bracket without one — whatever was
 * typed. A figure left behind by a change of mind is ignored rather than
 * cleared, because the ceiling is read first.
 */
export function resolveWeightKg(
  bracket: WeightBracketId,
  exactWeightKg: number | undefined
): number | undefined {
  return WEIGHT_BRACKET_MAX_KG[bracket] ?? exactWeightKg;
}

export const SIZE_PRESET_IDS = ["s", "m", "l", "xl", "xxl"] as const;

export type SizePresetId = (typeof SIZE_PRESET_IDS)[number];

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/** Each preset is the largest thing that still counts as that size. */
export const SIZE_PRESET_DIMENSIONS = {
  s: { lengthCm: 40, widthCm: 30, heightCm: 25 },
  m: { lengthCm: 80, widthCm: 60, heightCm: 50 },
  l: { lengthCm: 180, widthCm: 80, heightCm: 120 },
  xl: { lengthCm: 220, widthCm: 100, heightCm: 200 },
  xxl: { lengthCm: 300, widthCm: 150, heightCm: 220 },
} as const satisfies Record<SizePresetId, Dimensions>;

export const SIZE_MODES = ["preset", "exact"] as const;

export type SizeMode = (typeof SIZE_MODES)[number];

/**
 * Only the active mode is read, so switching back and forth never mixes a
 * preset with a typed number. Size stays optional: `preset` with nothing chosen
 * submits no dimensions, exactly as three blank fields did.
 */
export function resolveDimensions(
  mode: SizeMode,
  preset: SizePresetId | undefined,
  typed: Partial<Dimensions>
): Partial<Dimensions> {
  if (mode === "exact") {
    return {
      lengthCm: typed.lengthCm,
      widthCm: typed.widthCm,
      heightCm: typed.heightCm,
    };
  }
  return preset ? { ...SIZE_PRESET_DIMENSIONS[preset] } : {};
}
