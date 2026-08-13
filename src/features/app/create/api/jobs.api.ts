import { api } from "@/lib/fetcher";
import type { Job } from "@/features/app/listing/types";
import type { JobFormOutput } from "../schemas";

/** Translates form values into the REST contract. */
export function toCreatePayload(values: JobFormOutput, publish: boolean) {
  return {
    title: values.title,
    description: values.description,
    categoryId: values.categoryId,
    weightKg: values.weightKg,
    lengthCm: values.lengthCm,
    widthCm: values.widthCm,
    heightCm: values.heightCm,
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
