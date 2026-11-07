import { api } from "@/lib/fetcher";
import type { Job } from "@/features/app/listing/types";
import { movingWeightKg } from "@/lib/moving";
import { resolveDimensions, resolveWeightKg } from "../cargo";
import type { JobFormOutput } from "../schemas";

/**
 * Translates form values into the REST contract.
 *
 * `categoryId` is deliberately absent: a person describing a wardrobe should
 * not have to file it into a taxonomy, so the service resolves one. `origin` is
 * absent for a stronger reason — it decides who may award the job, and is
 * stamped server-side so a caller cannot post work into the operator queue.
 *
 * This is also where a weight bracket and a size preset become the numbers the
 * API has always wanted, which is what lets `createListingSchema` stay exactly
 * as it was (docs/specs/cargo_input_spec.md §2). `fragileNote` joins them the
 * same way: it has no column of its own, so it is folded into `description`
 * rather than teaching the DTO a new field.
 */
const FRAGILE_NOTE_SEPARATOR = "\n\nFragile: ";

function withFragileNote(values: JobFormOutput): string {
  const note = values.isFragile ? values.fragileNote?.trim() : undefined;
  return note ? `${values.description}${FRAGILE_NOTE_SEPARATOR}${note}` : values.description;
}

/**
 * The reverse, for resuming a saved request: without it every save would fold
 * the note in once more (draft_requests_spec.md §2). Split at the last
 * separator, so a description that itself mentions "Fragile:" stays whole.
 */
export function splitFragileNote(
  description: string,
  isFragile: boolean
): { description: string; fragileNote?: string } {
  const at = isFragile ? description.lastIndexOf(FRAGILE_NOTE_SEPARATOR) : -1;
  if (at === -1) return { description };
  return {
    description: description.slice(0, at),
    fragileNote: description.slice(at + FRAGILE_NOTE_SEPARATOR.length),
  };
}

/**
 * `saveAddress`/`addressLabel` are client-only, the same way `fragileNote` is
 * — `useJobForm`'s `handleNext` already acts on them (saving to the address
 * book) before this payload is ever built, so they have nothing left to say
 * to the API. `locationEntry` only decides what the form asks for; a place
 * given as a link reaches the API as the coordinates it resolved to.
 */
function stripAddressMeta(endpoint: JobFormOutput["pickup"]) {
  const {
    saveAddress: _saveAddress,
    addressLabel: _addressLabel,
    locationEntry: _locationEntry,
    ...rest
  } = endpoint;
  return rest;
}

/**
 * What is moved. Items as the What step describes them; a move as its size
 * alone — one load, the movers loading it, a weight derived from the volume
 * because vehicle matching reads `weightKg` (client_feedback_2026_10_31_spec.md
 * §2.2). Whatever the other mode still holds is left behind.
 */
interface Cargo {
  description: string;
  weightKg: number | undefined;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  quantity: number;
  isFragile: boolean;
  needsHelp: boolean;
  movingSurfaceM2?: number;
  movingVolumeM3?: number;
}

function cargo(values: JobFormOutput): Cargo {
  if (values.jobKind === "moving") {
    const size =
      values.movingSizeMode === "volume"
        ? { movingVolumeM3: values.movingVolumeM3 }
        : { movingSurfaceM2: values.movingSurfaceM2 };
    return {
      ...size,
      description: values.description,
      weightKg: movingWeightKg({
        surfaceM2: size.movingSurfaceM2,
        volumeM3: size.movingVolumeM3,
      }) ?? undefined,
      quantity: 1,
      isFragile: false,
      needsHelp: true,
    };
  }
  return {
    description: withFragileNote(values),
    weightKg: values.weightBracket
      ? resolveWeightKg(values.weightBracket, values.exactWeightKg)
      : undefined,
    ...resolveDimensions(values.sizeMode, values.sizePreset, values),
    quantity: values.quantity,
    isFragile: values.isFragile,
    needsHelp: values.needsHelp,
  };
}

export function toCreatePayload(values: JobFormOutput, publish: boolean) {
  return {
    jobKind: values.jobKind,
    title: values.title,
    ...cargo(values),
    accessHeightCm: values.accessHeightCm,
    packagingLevel: values.packagingLevel,
    needsProtection: values.needsProtection,
    needsPackaging: values.needsPackaging,
    pickup: stripAddressMeta(values.pickup),
    dropoff: stripAddressMeta(values.dropoff),
    pickupFrom: values.pickupFrom.toISOString(),
    pickupUntil: values.pickupUntil.toISOString(),
    dropoffFrom: values.dropoffFrom.toISOString(),
    dropoffUntil: values.dropoffUntil.toISOString(),
    isFlexible: values.isFlexible,
    // Weekdays and times of day at each end — full sets unless a flexible
    // request narrowed them (request_availability_spec.md §3).
    pickupDays: values.pickupDays,
    pickupPeriods: values.pickupPeriods,
    dropoffDays: values.dropoffDays,
    dropoffPeriods: values.dropoffPeriods,
    // The form works in euros; the API is cents throughout.
    budgetCents: Math.round(values.budgetEuros * 100),
    photos: values.photos,
    publish,
    // A draft keeps no schedule: nothing publishes a draft at its scheduled
    // time (publication_timing_spec.md §2).
    ...(publish && values.publishMode === "schedule" && values.scheduledPublishAt
      ? { scheduledPublishAt: values.scheduledPublishAt.toISOString() }
      : {}),
  };
}

export const jobsApi = {
  create: (values: JobFormOutput, publish: boolean) =>
    api.post<Job>("/api/listings", toCreatePayload(values, publish)),
  /** A request that has not gone live, saved again, scheduled or published. */
  saveDraft: (listingId: string, values: JobFormOutput, publish: boolean) =>
    api.put<Job>(`/api/listings/${listingId}/draft`, toCreatePayload(values, publish)),
};
