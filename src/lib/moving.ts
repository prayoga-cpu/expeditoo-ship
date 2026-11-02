/**
 * A move, as opposed to items (client_feedback_2026_10_31_spec.md §2): sized
 * by the home's surface or by its volume, and stored with a weight derived
 * from either, because `weight_kg` is what vehicle matching reads.
 */

export const JOB_KINDS = ["items", "moving"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/** « Superficie du logement » — a studio to a large house, whole m². */
export const MOVING_SURFACE_M2 = { min: 5, max: 1000 } as const;
/** « Je connais le volume exact » — half a cubic metre to a full lorry. */
export const MOVING_VOLUME_M3 = { min: 0.5, max: 200 } as const;

/** The trade's rule of thumb: a home's volume is about half its surface. */
const M3_PER_M2 = 0.5;
/** And a cubic metre of furniture and boxes weighs about 150 kg (spec §0 D). */
const KG_PER_M3 = 150;
/** French road transport limit, as `MAX_WEIGHT_KG` in `listings.dto.ts`. */
const MAX_WEIGHT_KG = 44_000;

export interface MovingSize {
  surfaceM2?: number | null;
  volumeM3?: number | null;
}

/** The volume given, or the one the surface suggests. */
export function movingVolumeM3({ surfaceM2, volumeM3 }: MovingSize): number | null {
  if (volumeM3 != null) return volumeM3;
  if (surfaceM2 != null) return surfaceM2 * M3_PER_M2;
  return null;
}

/** The weight a move is stored with, whole kilograms, or null with no size. */
export function movingWeightKg(size: MovingSize): number | null {
  const volume = movingVolumeM3(size);
  if (volume == null) return null;
  return Math.min(MAX_WEIGHT_KG, Math.max(1, Math.round(volume * KG_PER_M3)));
}
