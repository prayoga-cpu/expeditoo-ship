/**
 * A stored job read back as the size label a driver scans for.
 *
 * `/create` lets a requester pick S…XXL and resolves it to three centimetre
 * figures (`cargo.ts`); the database keeps only those figures. The board wants
 * the label back, so this is that reverse — the smallest preset whose every
 * dimension still contains the load.
 *
 * It is a *classification*, not a round trip: a job whose dimensions were typed
 * exactly, or escalated from Expedion, never passed through a preset, and this
 * still labels it. Anything past the largest preset is `xxxl`, which is a badge
 * rather than a preset because nothing offers it as an input.
 *
 * See docs/specs/board_route_search_spec.md §9.
 */

import {
  SIZE_PRESET_DIMENSIONS,
  SIZE_PRESET_IDS,
  type SizePresetId,
} from "@/features/app/create/cargo";

export type CargoSizeLabel = SizePresetId | "xxxl";

export interface CargoDimensions {
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

/**
 * The badge for a job, or null when it never said how big it is.
 *
 * Dimensions are all-or-nothing at the DTO (`DIMENSIONS_INCOMPLETE`), so a
 * partial set means legacy data rather than a half-filled form, and gets no
 * badge instead of a guess.
 */
export function cargoSizeLabel(
  dimensions: CargoDimensions
): CargoSizeLabel | null {
  const { lengthCm, widthCm, heightCm } = dimensions;
  if (lengthCm == null || widthCm == null || heightCm == null) return null;

  // Orientation is not part of the answer: a 180×30×30 plank and a 30×30×180
  // one are the same load turned on its side, so both are compared longest
  // side to longest side.
  const load = [lengthCm, widthCm, heightCm].sort((a, b) => b - a);

  for (const preset of SIZE_PRESET_IDS) {
    const ceiling = SIZE_PRESET_DIMENSIONS[preset];
    const limits = [
      ceiling.lengthCm,
      ceiling.widthCm,
      ceiling.heightCm,
    ].sort((a, b) => b - a);

    if (load.every((side, i) => side <= limits[i])) return preset;
  }

  return "xxxl";
}
