import type { UseFormSetValue } from "react-hook-form";

import { numberToInput } from "@/lib/numeric-input";
import type {
  AssistantEnd,
  AssistantSide,
  RequestDraft,
} from "@/server/dto/request-assistant.dto";
import type { JobFormValues } from "./schemas";
import { addDays, defaultEndpointTiming, type TimingState } from "./timing";

/**
 * The request assistant's answer, written onto the form
 * (docs/specs/request_assistant_spec.md §4).
 *
 * Only what the assistant found is written: a field it left null keeps
 * whatever the person had already typed. The days it read are the When step's,
 * which holds a state of its own: `timingFromDraft` below. Nothing is validated here on purpose
 * — the values land exactly as if they had been typed, and each step's own
 * rules read them when « Suivant » is pressed.
 */

/** Everything said so far, as the one text the next reading is made from. */
export function joinSaid(said: readonly string[]): string {
  return said
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}

/** Whether the reading found anything at all to put on the form. */
export function hasFindings(draft: RequestDraft): boolean {
  return (
    draft.title !== null ||
    draft.weightBracket !== null ||
    draft.sizePreset !== null ||
    draft.dimensions !== null ||
    draft.pickup !== null ||
    draft.dropoff !== null ||
    draft.pickupDate !== null ||
    draft.deliveryDate !== null
  );
}

/**
 * A town at one end. It replaces the whole end: a street or a pin left over
 * from another address would describe somewhere else. `locationEntry` is
 * « address » so the Where step opens on the typed town rather than on an
 * empty map search.
 */
function applyEnd(
  setValue: UseFormSetValue<JobFormValues>,
  side: AssistantSide,
  end: AssistantEnd
) {
  // The country first: the postal code is checked against it.
  setValue(`${side}.country`, end.country);
  setValue(`${side}.address`, "");
  setValue(`${side}.city`, end.city);
  setValue(`${side}.postalCode`, end.postalCode);
  // No pin: a town is not a point, and a request posted without one is
  // placed by the server from its address.
  setValue(`${side}.lat`, undefined as unknown as number);
  setValue(`${side}.lng`, undefined as unknown as number);
  setValue(`${side}.saveAddress`, false);
  setValue(`${side}.addressLabel`, "");
  setValue(`${side}.locationEntry`, "address");
}

function applySize(
  setValue: UseFormSetValue<JobFormValues>,
  draft: RequestDraft,
  locale: string
) {
  if (draft.dimensions) {
    // The boxes hold their own text (numeric_input_spec.md §7).
    const text = (cm: number) => numberToInput(cm, 1, locale);
    setValue("sizeMode", "exact");
    setValue("sizePreset", undefined);
    setValue("lengthCm", text(draft.dimensions.lengthCm));
    setValue("widthCm", text(draft.dimensions.widthCm));
    setValue("heightCm", text(draft.dimensions.heightCm));
    return;
  }
  if (draft.sizePreset) {
    setValue("sizeMode", "preset");
    setValue("sizePreset", draft.sizePreset);
  }
}

/**
 * The When step with the days the assistant read, or `null` when it read none
 * and the step is to be left exactly as it is (request_assistant_spec.md
 * §4.6).
 *
 * A stated day is a one-day flexible range — « Du » and « Au » the same day,
 * every weekday and time of day allowed: the person named a day, not an hour,
 * and flexible is the form's own default. The end that was not stated keeps
 * what it held, moved only as far as it takes to stay on the right side of the
 * other: a delivery never before its pickup (the day after it, the shape the
 * form's defaults have), a pickup never after its delivery (that same day).
 *
 * Pure: the form's state goes in and comes out, and the caller derives the
 * four instants from it as it does for a change made by hand.
 */
export function timingFromDraft(
  current: TimingState,
  draft: Pick<RequestDraft, "pickupDate" | "deliveryDate">
): TimingState | null {
  const { pickupDate, deliveryDate } = draft;
  if (!pickupDate && !deliveryDate) return null;

  let pickup = pickupDate ? defaultEndpointTiming(pickupDate) : current.pickup;
  let dropoff = deliveryDate ? defaultEndpointTiming(deliveryDate) : current.dropoff;

  if (!deliveryDate && dropoff.date < pickup.date) {
    dropoff = defaultEndpointTiming(addDays(pickup.date, 1));
  }
  if (!pickupDate && pickup.date > dropoff.date) {
    pickup = defaultEndpointTiming(dropoff.date);
  }
  return { mode: "flexible", pickup: wholeRange(pickup), dropoff: wholeRange(dropoff) };
}

/**
 * An end kept from « Date précise » has an « Au » nobody was shown; a range
 * that ends before it starts is not what the person chose.
 */
function wholeRange(endpoint: TimingState["pickup"]): TimingState["pickup"] {
  return endpoint.dateUntil < endpoint.date
    ? { ...endpoint, dateUntil: endpoint.date }
    : endpoint;
}

/**
 * Write the draft onto the form. Answers which ends it filled, so the caller
 * can stop the address book from filling them again.
 */
export function applyRequestDraft(
  setValue: UseFormSetValue<JobFormValues>,
  draft: RequestDraft,
  locale: string
): Record<AssistantSide, boolean> {
  if (draft.title !== null) setValue("title", draft.title);
  if (draft.quantity !== null) setValue("quantity", draft.quantity);

  if (draft.weightBracket !== null) {
    setValue("weightBracket", draft.weightBracket);
    // A number, unlike the size boxes: `WeightBracketField` keeps its own
    // text and hands the form the figure.
    setValue("exactWeightKg", draft.exactWeightKg ?? undefined);
  }

  applySize(setValue, draft, locale);

  if (draft.pickup) applyEnd(setValue, "pickup", draft.pickup);
  if (draft.dropoff) applyEnd(setValue, "dropoff", draft.dropoff);

  return { pickup: draft.pickup !== null, dropoff: draft.dropoff !== null };
}
