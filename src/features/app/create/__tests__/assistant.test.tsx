import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestDraft } from "@/server/dto/request-assistant.dto";
import fr from "../../../../../messages/fr.json";
import { hasFindings, joinSaid, timingFromDraft } from "../assistant";
import { suggestionFill } from "../cargo";
import { ISO_WEEKDAYS, TIME_SLOTS, addDays, defaultTimingState } from "../timing";

/**
 * The assistant's reading written onto the real form
 * (request_assistant_spec.md §4, §7): only what was found, in the shape each
 * box holds, and without the address book writing over a town afterwards.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: (...a: unknown[]) => toastSuccess(...a) },
}));

vi.mock("@/features/app/profile/api/addresses.api", () => ({ createAddress: vi.fn() }));

import { useJobForm } from "../hooks/useJobForm";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const draft = (over: Partial<RequestDraft> = {}): RequestDraft => ({
  title: "Canapé 3 places",
  quantity: 1,
  weightBracket: "upTo100",
  exactWeightKg: null,
  sizePreset: "xl",
  dimensions: null,
  pickup: { city: "Lyon", postalCode: "69002", country: "FR" },
  dropoff: { city: "Bruxelles", postalCode: "1000", country: "BE" },
  pickupDate: null,
  deliveryDate: null,
  missing: [],
  outOfArea: [],
  ...over,
});

const NOTHING = draft({
  title: null,
  quantity: null,
  weightBracket: null,
  sizePreset: null,
  pickup: null,
  dropoff: null,
});

const home = {
  id: "a1",
  label: "home",
  street: "Voie du Loup",
  city: "Annecy",
  zip: "74000",
  country: "France",
  lat: 45.9,
  lng: 6.12,
  isDefault: true,
  usedFor: null,
};

const filled = (reading: RequestDraft) => {
  const { result } = renderHook(() => useJobForm(), { wrapper });
  act(() => result.current.applyAssistant(reading));
  return result;
};

beforeEach(() => vi.clearAllMocks());

describe("applyAssistant", () => {
  it("writes the item, its size and weight and both towns", () => {
    const values = filled(draft()).current.form.getValues();

    expect(values).toMatchObject({
      title: "Canapé 3 places",
      quantity: 1,
      weightBracket: "upTo100",
      sizeMode: "preset",
      sizePreset: "xl",
    });
    expect(values.pickup).toMatchObject({
      city: "Lyon",
      postalCode: "69002",
      country: "FR",
      address: "",
      locationEntry: "address",
    });
    expect(values.dropoff).toMatchObject({ city: "Bruxelles", postalCode: "1000", country: "BE" });
  });

  it("gives a town no pin: a town is not a point", () => {
    const { pickup } = filled(draft()).current.form.getValues();

    expect(pickup.lat).toBeUndefined();
    expect(pickup.lng).toBeUndefined();
  });

  it("writes stated measurements as the boxes' own text, in French", () => {
    const values = filled(
      draft({ sizePreset: null, dimensions: { lengthCm: 210.5, widthCm: 95, heightCm: 80 } })
    ).current.form.getValues();

    expect(values).toMatchObject({
      sizeMode: "exact",
      lengthCm: "210,5",
      widthCm: "95",
      heightCm: "80",
    });
    expect(values.sizePreset).toBeUndefined();
  });

  it("writes a stated weight as the figure inside its bracket", () => {
    const values = filled(
      draft({ weightBracket: "upTo30", exactWeightKg: 24 })
    ).current.form.getValues();

    expect(values).toMatchObject({ weightBracket: "upTo30", exactWeightKg: 24 });
  });

  it("leaves alone what the reading did not find", () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    act(() => {
      result.current.form.setValue("title", "Mon armoire");
      result.current.form.setValue("pickup.city", "Nantes");
    });

    act(() => result.current.applyAssistant(draft({ title: null, pickup: null })));

    const values = result.current.form.getValues();
    expect(values.title).toBe("Mon armoire");
    expect(values.pickup.city).toBe("Nantes");
    expect(values.dropoff.city).toBe("Bruxelles");
  });

  it("remounts the What step and says the form was filled", () => {
    const result = filled(draft());

    expect(result.current.assistantFills).toBe(1);
    expect(toastSuccess).toHaveBeenCalledWith(fr.create.assistant.toast.filled);
  });

  it("keeps the address book from writing over a town it filled", () => {
    const result = filled(draft());

    // « Où » mounts and hands over the saved addresses.
    act(() => result.current.prefillAddresses([home] as never));

    expect(result.current.form.getValues("pickup")).toMatchObject({
      city: "Lyon",
      address: "",
    });
  });

  it("still lets the address book fill the ends when it found no town", () => {
    const result = filled(draft({ pickup: null, dropoff: null }));

    act(() => result.current.prefillAddresses([home] as never));

    expect(result.current.form.getValues("pickup.address")).toBe("Voie du Loup");
  });
});

/** A day `n` days from the form's own default pickup, as the box holds it. */
const dayFromNow = (n: number) => addDays(defaultTimingState().pickup.date, n - 1);

describe("applyAssistant — the days it read", () => {
  it("leaves the When step alone when no day was stated", () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    const before = result.current.timing;

    act(() => result.current.applyAssistant(draft()));

    expect(result.current.timing).toBe(before);
  });

  it("writes both days as one-day flexible ranges, and the windows the form posts", () => {
    const pickupDate = dayFromNow(10);
    const deliveryDate = dayFromNow(12);

    const result = filled(draft({ pickupDate, deliveryDate }));

    expect(result.current.timing).toMatchObject({
      mode: "flexible",
      pickup: { date: pickupDate, dateUntil: pickupDate },
      dropoff: { date: deliveryDate, dateUntil: deliveryDate },
    });
    expect(result.current.form.getValues()).toMatchObject({
      isFlexible: true,
      pickupFrom: `${pickupDate}T06:00`,
      pickupUntil: `${pickupDate}T22:00`,
      dropoffFrom: `${deliveryDate}T06:00`,
      dropoffUntil: `${deliveryDate}T22:00`,
    });
  });

  it("moves « Date précise » to flexible: the person named a day, not an hour", () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    act(() =>
      result.current.handleTimingChange({ ...result.current.timing, mode: "exact" })
    );

    act(() => result.current.applyAssistant(draft({ pickupDate: dayFromNow(10) })));

    expect(result.current.timing.mode).toBe("flexible");
    expect(result.current.form.getValues("isFlexible")).toBe(true);
  });
});

describe("timingFromDraft", () => {
  const current = defaultTimingState();
  const dates = (pickupDate: string | null, deliveryDate: string | null) =>
    timingFromDraft(current, { pickupDate, deliveryDate });

  it("is nothing to write when no day was stated", () => {
    expect(dates(null, null)).toBeNull();
  });

  it("leaves weekdays and times of day at their defaults", () => {
    const narrowed = {
      ...current,
      pickup: { ...current.pickup, days: [1 as const], periods: ["evening" as const] },
    };

    const next = timingFromDraft(narrowed, { pickupDate: "2031-03-20", deliveryDate: null });

    expect(next?.pickup).toMatchObject({ days: [...ISO_WEEKDAYS], periods: [...TIME_SLOTS] });
  });

  it("moves the default delivery to the day after a pickup stated alone, when it would fall before", () => {
    const next = dates("2031-03-20", null);

    expect(next?.pickup).toMatchObject({ date: "2031-03-20", dateUntil: "2031-03-20" });
    expect(next?.dropoff).toMatchObject({ date: "2031-03-21", dateUntil: "2031-03-21" });
  });

  it("keeps a delivery already on or after the stated pickup", () => {
    // The default pickup's own day: the default delivery is the day after.
    const next = dates(current.pickup.date, null);

    expect(next?.dropoff).toEqual(current.dropoff);
  });

  it("crosses a month's end when it moves the delivery", () => {
    expect(dates("2031-01-31", null)?.dropoff.date).toBe("2031-02-01");
  });

  it("keeps the default pickup under a delivery stated alone", () => {
    const next = dates(null, "2031-03-22");

    expect(next?.pickup).toEqual(current.pickup);
    expect(next?.dropoff).toMatchObject({ date: "2031-03-22", dateUntil: "2031-03-22" });
  });

  it("brings the pickup back to a delivery stated alone that falls before it", () => {
    const late = { ...current, pickup: { ...current.pickup, date: "2031-06-01", dateUntil: "2031-06-03" } };

    const next = timingFromDraft(late, { pickupDate: null, deliveryDate: "2031-03-22" });

    expect(next?.pickup).toMatchObject({ date: "2031-03-22", dateUntil: "2031-03-22" });
  });

  it("gives an end kept from « Date précise » a range that does not end before it starts", () => {
    const exact = {
      ...current,
      mode: "exact" as const,
      dropoff: { ...current.dropoff, date: "2031-04-10", dateUntil: "2031-01-01" },
    };

    const next = timingFromDraft(exact, { pickupDate: "2031-03-20", deliveryDate: null });

    expect(next?.dropoff).toMatchObject({ date: "2031-04-10", dateUntil: "2031-04-10" });
  });
});

describe("applyAssistant — weight and size against a title suggestion", () => {
  const table = { id: "diningTable", weightBracket: "upTo100", sizePreset: "l" } as const;
  const byHand = (result: ReturnType<typeof filled>) => ({
    weight: result.current.cargoChoices.isByHand("weight"),
    size: result.current.cargoChoices.isByHand("size"),
  });

  it("makes what it wrote the requester's answer: a later suggestion changes the title only", () => {
    const result = filled(draft({ weightBracket: "upTo30", exactWeightKg: 24, sizePreset: "m" }));

    expect(byHand(result)).toEqual({ weight: true, size: true });
    expect(suggestionFill(table, byHand(result))).toEqual({
      weightBracket: undefined,
      sizePreset: undefined,
    });
  });

  it("leaves to the suggestions what it did not find", () => {
    const result = filled(draft({ weightBracket: null, sizePreset: null }));

    expect(byHand(result)).toEqual({ weight: false, size: false });
  });

  it("hands both back when the kind of request changes", () => {
    const result = filled(draft());

    act(() => result.current.setJobKind("moving"));

    expect(byHand(result)).toEqual({ weight: false, size: false });
  });
});

describe("joinSaid", () => {
  it("is everything said, in order, as one text", () => {
    expect(joinSaid([" un canapé de Lyon ", "", "vers Bordeaux"])).toBe(
      "un canapé de Lyon\nvers Bordeaux"
    );
  });
});

describe("hasFindings", () => {
  it("is false for a reading with nothing to put on the form", () => {
    expect(hasFindings(NOTHING)).toBe(false);
    // A count of nothing is not a finding.
    expect(hasFindings({ ...NOTHING, quantity: 2 })).toBe(false);
  });

  it("is true as soon as one field was read", () => {
    expect(hasFindings({ ...NOTHING, dropoff: draft().dropoff })).toBe(true);
    // A day is something to put on the form, even alone.
    expect(hasFindings({ ...NOTHING, pickupDate: "2031-03-20" })).toBe(true);
  });
});
