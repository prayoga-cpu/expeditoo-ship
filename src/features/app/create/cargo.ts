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
  "notSure",
] as const;

export type WeightBracketId = (typeof WEIGHT_BRACKET_IDS)[number];

/** Above this everything is freight, and freight gets weighed. */
export const HEAVY_BRACKET_MIN_KG = 1000;

/** The one bracket that asks for a figure instead of supplying one. */
export const HEAVY_BRACKET_ID = "over1000" satisfies WeightBracketId;

/**
 * `notSure` resolves to the same ceiling as `upTo500`: generous enough to
 * cover nearly every household item without reaching into freight-scale
 * vehicles a small job does not need. Same safe-overstatement direction every
 * other bracket already resolves toward, just for someone who genuinely
 * cannot say which of the first five fits.
 */
export const UNSURE_BRACKET_ID = "notSure" satisfies WeightBracketId;

/** Ceiling in kilograms; `null` means the person states the weight. */
export const WEIGHT_BRACKET_MAX_KG = {
  upTo5: 5,
  upTo30: 30,
  upTo100: 100,
  upTo500: 500,
  upTo1000: HEAVY_BRACKET_MIN_KG,
  over1000: null,
  notSure: 500,
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

/**
 * Common items someone types in "What are you moving?", each pointing at the
 * weight bracket and (where one clearly fits) the size preset a person would
 * otherwise have to pick by hand. Purely a typing shortcut — choosing a
 * suggestion only calls `setValue` on the same two client-only fields the
 * cards already write to, so it costs the API nothing and can be overridden
 * by hand afterward like any other bracket or preset choice.
 *
 * Labels live at `create.what.itemSuggestions.<id>`, one language at a time —
 * matching happens against whichever locale is on screen.
 */
export const ITEM_SUGGESTION_IDS = [
  "watch",
  "parcel",
  "suitcase",
  "movingBox",
  "booksBox",
  "computer",
  "printer",
  "artwork",
  "washingMachine",
  "dryer",
  "dishwasher",
  "armchair",
  "chair",
  "mirror",
  "tv",
  "bike",
  "scooter",
  "lawnMower",
  "sofa",
  "mattress",
  "fridge",
  "diningTable",
  "desk",
  "bookshelf",
  "gardenFurniture",
  "treadmill",
  "motorbike",
  "furniture",
  "doubleBed",
  "wardrobe",
  "piano",
  "pallet",
] as const;

export type ItemSuggestionId = (typeof ITEM_SUGGESTION_IDS)[number];

export interface ItemSuggestion {
  id: ItemSuggestionId;
  weightBracket: WeightBracketId;
  sizePreset?: SizePresetId;
}

export const ITEM_SUGGESTIONS = [
  { id: "watch", weightBracket: "upTo5", sizePreset: "s" },
  { id: "parcel", weightBracket: "upTo5", sizePreset: "s" },
  { id: "suitcase", weightBracket: "upTo30", sizePreset: "m" },
  { id: "movingBox", weightBracket: "upTo30", sizePreset: "m" },
  { id: "booksBox", weightBracket: "upTo30", sizePreset: "s" },
  { id: "computer", weightBracket: "upTo5", sizePreset: "s" },
  { id: "printer", weightBracket: "upTo5", sizePreset: "s" },
  { id: "artwork", weightBracket: "upTo5", sizePreset: "m" },
  { id: "washingMachine", weightBracket: "upTo100", sizePreset: "l" },
  { id: "dryer", weightBracket: "upTo100", sizePreset: "l" },
  { id: "dishwasher", weightBracket: "upTo100", sizePreset: "l" },
  { id: "armchair", weightBracket: "upTo100" },
  { id: "chair", weightBracket: "upTo30", sizePreset: "m" },
  { id: "mirror", weightBracket: "upTo30", sizePreset: "m" },
  { id: "tv", weightBracket: "upTo30", sizePreset: "m" },
  { id: "bike", weightBracket: "upTo30", sizePreset: "l" },
  { id: "scooter", weightBracket: "upTo30", sizePreset: "m" },
  { id: "lawnMower", weightBracket: "upTo30", sizePreset: "m" },
  { id: "sofa", weightBracket: "upTo100", sizePreset: "xl" },
  { id: "mattress", weightBracket: "upTo100", sizePreset: "xl" },
  { id: "fridge", weightBracket: "upTo100", sizePreset: "xl" },
  { id: "diningTable", weightBracket: "upTo100", sizePreset: "l" },
  { id: "desk", weightBracket: "upTo100", sizePreset: "l" },
  { id: "bookshelf", weightBracket: "upTo100", sizePreset: "l" },
  { id: "gardenFurniture", weightBracket: "upTo100", sizePreset: "l" },
  { id: "treadmill", weightBracket: "upTo100", sizePreset: "l" },
  { id: "motorbike", weightBracket: "upTo500" },
  { id: "furniture", weightBracket: "upTo500" },
  { id: "doubleBed", weightBracket: "upTo100", sizePreset: "xxl" },
  { id: "wardrobe", weightBracket: "upTo500", sizePreset: "xxl" },
  { id: "piano", weightBracket: "upTo500", sizePreset: "xxl" },
  { id: "pallet", weightBracket: "upTo1000", sizePreset: "xxl" },
] as const satisfies readonly ItemSuggestion[];
