import { api } from "@/lib/fetcher";
import type { Job } from "@/features/app/listing/types";
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
 * as it was (docs/specs/cargo_input_spec.md §2).
 */
export function toCreatePayload(values: JobFormOutput, publish: boolean) {
  return {
    title: values.title,
    description: values.description,
    weightKg: resolveWeightKg(values.weightBracket, values.exactWeightKg),
    ...resolveDimensions(values.sizeMode, values.sizePreset, values),
    quantity: values.quantity,
    isFragile: values.isFragile,
    needsHelp: values.needsHelp,
    pickup: values.pickup,
    dropoff: values.dropoff,
    pickupFrom: values.pickupFrom.toISOString(),
    pickupUntil: values.pickupUntil.toISOString(),
    dropoffFrom: values.dropoffFrom.toISOString(),
    dropoffUntil: values.dropoffUntil.toISOString(),
    isFlexible: values.isFlexible,
    // The form works in euros; the API is cents throughout.
    budgetCents: Math.round(values.budgetEuros * 100),
    photos: values.photos,
    publish,
  };
}

export const jobsApi = {
  create: (values: JobFormOutput, publish: boolean) =>
    api.post<Job>("/api/listings", toCreatePayload(values, publish)),
};
