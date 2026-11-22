import { z } from "zod";

import { JOB_COUNTRIES } from "@/lib/countries";
import {
  SIZE_PRESET_IDS,
  WEIGHT_BRACKET_IDS,
} from "@/features/app/create/cargo";

/**
 * The request assistant on `/create`: a sentence in, form values out
 * (docs/specs/request_assistant_spec.md).
 *
 * Nothing here is a listing. The answer is a set of values the form may be
 * filled with, in the form's own vocabulary — a weight bracket, a size preset,
 * a town with its postal code — and the requester still walks the form and
 * publishes through it. That is why the shape carries no price, no `origin`
 * and no id: there is nothing for the model to decide that the form does not
 * ask the person again. It does carry the two days the person stated, since
 * 2.91.0 — a calendar day each, checked by the service, shown on the When step
 * before anything is posted (spec §4.6).
 */

/** A paragraph, not a document: what one person says about one request. */
export const ASSISTANT_TEXT_MAX = 1500;

export const assistRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, "TEXT_TOO_SHORT")
    .max(ASSISTANT_TEXT_MAX, "TEXT_TOO_LONG"),
});

export type AssistRequest = z.infer<typeof assistRequestSchema>;

/** What the form needs before a carrier can read the request. */
export const ASSISTANT_FIELDS = [
  "title",
  "size",
  "weight",
  "pickup",
  "dropoff",
  // Asked last, and never in the way of « Remplir le formulaire »: the When
  // step has dates of its own.
  "when",
] as const;

export type AssistantField = (typeof ASSISTANT_FIELDS)[number];

export const ASSISTANT_SIDES = ["pickup", "dropoff"] as const;
export type AssistantSide = (typeof ASSISTANT_SIDES)[number];

/** An end as far as a sentence gives it: a town, never a street or a pin. */
export const assistantEndSchema = z.object({
  city: z.string().min(1).max(120),
  /** Blank when the town could not be looked up; the form asks for it. */
  postalCode: z.string().max(12),
  /** Any country or territory; France when the sentence names none. */
  country: z.enum(JOB_COUNTRIES),
});

export type AssistantEnd = z.infer<typeof assistantEndSchema>;

/** A calendar day, `YYYY-MM-DD`: no hour, no timezone. */
const assistantDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const requestDraftSchema = z.object({
  title: z.string().min(1).max(120).nullable(),
  quantity: z.number().int().min(1).max(99_999).nullable(),
  weightBracket: z.enum(WEIGHT_BRACKET_IDS).nullable(),
  /** Only a weight the person stated; a bracket alone is its ceiling. */
  exactWeightKg: z.number().positive().max(44_000).nullable(),
  sizePreset: z.enum(SIZE_PRESET_IDS).nullable(),
  /** Only measurements the person stated, all three of them. */
  dimensions: z
    .object({
      lengthCm: z.number().positive(),
      widthCm: z.number().positive(),
      heightCm: z.number().positive(),
    })
    .nullable(),
  pickup: assistantEndSchema.nullable(),
  dropoff: assistantEndSchema.nullable(),
  /**
   * Only a day the person stated, already checked: a real date, from today
   * (Europe/Paris) to twelve months ahead. Anything else is null.
   */
  pickupDate: assistantDaySchema.nullable(),
  /** The same, and never before `pickupDate`. */
  deliveryDate: assistantDaySchema.nullable(),
  /** What the sentence did not say, in the order the assistant asks for it. */
  missing: z.array(z.enum(ASSISTANT_FIELDS)),
});

export type RequestDraft = z.infer<typeof requestDraftSchema>;

/** A recording is a sentence or two; this is well past a minute of speech. */
export const ASSISTANT_AUDIO_MAX_BYTES = 4 * 1024 * 1024;

export const transcribeLocaleSchema = z.enum(["fr", "en"]).default("fr");
