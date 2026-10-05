import { describe, expect, it } from "vitest";

import type { DraftJob } from "@/features/app/listing/types";
import { toCreatePayload } from "../api/jobs.api";
import { SIZE_PRESET_DIMENSIONS, SIZE_PRESET_IDS } from "../cargo";
import { fromListing } from "../from-listing";
import { jobFormSchema, type JobFormOutput } from "../schemas";
import { resolveTimingWindows, timingFieldValues } from "../timing";

/**
 * A saved request, rebuilt into the form and posted back, must be the request
 * that was saved (docs/specs/draft_requests_spec.md §2). Dates are built with
 * local constructors, so this holds in any timezone. 2030-01-07 is a Monday.
 */

const EARLY = new Date(2029, 11, 30, 8, 0);
const local = (day: number, hour: number, minute = 0) => new Date(2030, 0, day, hour, minute);

function draft(over: Partial<DraftJob> = {}): DraftJob {
  return {
    id: "job-1",
    reference: 100042,
    shipperId: "requester-1",
    status: "draft",
    title: "Armoire normande",
    description: "Une armoire démontée, deux colis.",
    weightKg: 100,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    quantity: 2,
    isFragile: false,
    needsHelp: true,
    packagingLevel: "protected",
    needsProtection: false,
    needsPackaging: true,
    pickupAddress: "12 rue de la République",
    pickupCity: "Lyon",
    pickupPostalCode: "69002",
    pickupLocationType: "apartment",
    pickupLat: 45.764,
    pickupLng: 4.8357,
    pickupFloor: 3,
    pickupHasLift: false,
    pickupNote: "Code 4521B",
    pickupContactName: "Mat",
    pickupContactPhone: "+33612345678",
    dropoffAddress: "3 rue Paradis",
    dropoffCity: "Marseille",
    dropoffPostalCode: "13001",
    dropoffLocationType: "house",
    dropoffLat: 43.2965,
    dropoffLng: 5.3698,
    dropoffFloor: null,
    dropoffHasLift: null,
    dropoffNote: null,
    dropoffContactName: null,
    dropoffContactPhone: "+33698765432",
    pickupFrom: local(7, 9).toISOString(),
    pickupUntil: local(7, 10).toISOString(),
    dropoffFrom: local(9, 14, 30).toISOString(),
    dropoffUntil: local(9, 15, 30).toISOString(),
    isFlexible: false,
    pickupDays: [1, 2, 3, 4, 5, 6, 7],
    pickupPeriods: ["morning", "afternoon", "evening"],
    dropoffDays: [1, 2, 3, 4, 5, 6, 7],
    dropoffPeriods: ["morning", "afternoon", "evening"],
    budgetCents: 4_000,
    acceptedOfferId: null,
    origin: "direct",
    offersCount: 0,
    views: 0,
    expiresAt: local(7, 3).toISOString(),
    reopenedAt: null,
    scheduledPublishAt: null,
    createdAt: local(1, 12).toISOString(),
    updatedAt: local(1, 12).toISOString(),
    photos: [
      { id: "p2", url: "https://x/2.jpg", order: 1 },
      { id: "p1", url: "https://x/1.jpg", order: 0 },
    ],
    ...over,
  };
}

/** What the form would post, from the request rebuilt at `now` in French. */
function roundTrip(job: DraftJob, now = EARLY) {
  const resumed = fromListing(job, { locale: "fr", now });
  const windows = timingFieldValues(resolveTimingWindows(resumed.timing, now));
  const parsed = jobFormSchema.parse({ ...resumed.values, ...windows });
  return { resumed, payload: toCreatePayload(parsed as unknown as JobFormOutput, false) };
}

describe("fromListing — the request comes back as it was saved", () => {
  it("posts the same request back", () => {
    const job = draft();
    const { payload } = roundTrip(job);

    expect(payload).toMatchObject({
      title: job.title,
      description: job.description,
      weightKg: 100,
      quantity: 2,
      needsHelp: true,
      packagingLevel: "protected",
      needsPackaging: true,
      budgetCents: 4_000,
      isFlexible: false,
      pickupFrom: job.pickupFrom,
      pickupUntil: job.pickupUntil,
      dropoffFrom: job.dropoffFrom,
      dropoffUntil: job.dropoffUntil,
      photos: ["https://x/1.jpg", "https://x/2.jpg"],
    });
    expect(payload.pickup).toMatchObject({
      address: job.pickupAddress,
      postalCode: "69002",
      locationType: "apartment",
      floor: 3,
      hasLift: false,
      note: "Code 4521B",
      contactName: "Mat",
      contactPhone: "+33612345678",
      lat: 45.764,
    });
  });

  it.each([5, 30, 100, 500, 1000, 80, 450, 12_000])("keeps a weight of %d kg", (weightKg) => {
    expect(roundTrip(draft({ weightKg })).payload.weightKg).toBe(weightKg);
  });

  it.each([
    [null, null, null],
    [180, 80, 120],
    [95, 45.5, 60],
  ])("keeps a size of %s × %s × %s", (lengthCm, widthCm, heightCm) => {
    const { payload } = roundTrip(draft({ lengthCm, widthCm, heightCm }));

    expect(payload.lengthCm ?? null).toBe(lengthCm);
    expect(payload.widthCm ?? null).toBe(widthCm);
    expect(payload.heightCm ?? null).toBe(heightCm);
  });

  it.each(SIZE_PRESET_IDS)("keeps the %s size, picked as that size", (preset) => {
    const dimensions = SIZE_PRESET_DIMENSIONS[preset];
    const { resumed, payload } = roundTrip(draft({ ...dimensions }));

    expect(resumed.values).toMatchObject({ sizeMode: "preset", sizePreset: preset });
    expect(payload).toMatchObject(dimensions);
  });

  it("fills the typed boxes as the requester's language writes them", () => {
    const job = draft({ budgetCents: 4_050, lengthCm: 95, widthCm: 45.5, heightCm: 60 });

    const fr = fromListing(job, { locale: "fr", now: EARLY }).values;
    expect(fr).toMatchObject({ budgetEuros: "40,50", lengthCm: "95", widthCm: "45,5" });
    expect(fromListing(job, { locale: "en", now: EARLY }).values).toMatchObject({
      budgetEuros: "40.50",
      widthCm: "45.5",
    });
    expect(roundTrip(job).payload).toMatchObject({ budgetCents: 4_050, widthCm: 45.5 });
  });

  it("splits a fragile note off and folds it back exactly once", () => {
    const job = draft({ isFragile: true, description: "Une armoire.\n\nFragile: miroir intégré" });
    const { resumed, payload } = roundTrip(job);

    expect(resumed.values.description).toBe("Une armoire.");
    expect(resumed.values.fragileNote).toBe("miroir intégré");
    expect(payload.description).toBe(job.description);
  });

  it("keeps a flexible range, its weekdays and its times of day", () => {
    // Monday 7 → Friday 11, Monday Wednesday Friday, mornings and evenings.
    const job = draft({
      isFlexible: true,
      pickupFrom: local(7, 6).toISOString(),
      pickupUntil: local(11, 22).toISOString(),
      pickupDays: [1, 3, 5],
      pickupPeriods: ["morning", "evening"],
      dropoffFrom: local(14, 6).toISOString(),
      dropoffUntil: local(15, 22).toISOString(),
    });
    const { resumed, payload } = roundTrip(job);

    expect(resumed.timing.mode).toBe("flexible");
    expect(payload).toMatchObject({
      isFlexible: true,
      pickupFrom: job.pickupFrom,
      pickupUntil: job.pickupUntil,
      pickupDays: [1, 3, 5],
      pickupPeriods: ["morning", "evening"],
      dropoffFrom: job.dropoffFrom,
    });
  });

  it("brings a scheduled request back scheduled, while its moment is ahead", () => {
    const at = local(5, 18);
    const { resumed } = roundTrip(draft({ status: "scheduled", scheduledPublishAt: at.toISOString() }));

    expect(resumed.values.publishMode).toBe("schedule");
    expect(new Date(resumed.values.scheduledPublishAt as string).getTime()).toBe(at.getTime());
  });

  it("asks again when the scheduled moment has passed", () => {
    const { resumed } = roundTrip(
      draft({ status: "scheduled", scheduledPublishAt: local(1, 8).toISOString() }),
      local(2, 8)
    );

    expect(resumed.values.publishMode).toBe("now");
  });

  it("never adds to the address book on the way through", () => {
    const { resumed } = roundTrip(draft());

    expect(resumed.values.pickup?.saveAddress).toBe(false);
    expect(resumed.values.dropoff?.saveAddress).toBe(false);
  });
});

// A request saved before the half-hour list took any minute.
describe("fromListing — an exact time the half-hour list cannot show", () => {
  const pickupAt = (at: Date) =>
    draft({
      pickupFrom: at.toISOString(),
      pickupUntil: new Date(at.getTime() + 3600_000).toISOString(),
    });

  it.each([
    // Fifteen minutes from 09:00 and from 09:30: the later, still inside the
    // window the saved time opened.
    ["09:15", local(7, 9, 15), "09:30", local(7, 9, 30)],
    // After the evening's last choice, and before the morning's first.
    ["22:30", local(7, 22, 30), "21:30", local(7, 21, 30)],
    ["05:00", local(7, 5, 0), "06:00", local(7, 6, 0)],
  ])("moves %s to the nearest choice and names both", (saved, at, selected, posted) => {
    const { resumed, payload } = roundTrip(pickupAt(at));

    expect(resumed.snappedTimes).toEqual([{ side: "pickup", saved, selected, hour: selected }]);
    expect(resumed.timing.pickup.hour).toBe(selected);
    expect(payload.pickupFrom).toBe(posted.toISOString());
  });

  it("names the delivery when it is the time that moved", () => {
    const { resumed } = roundTrip(
      draft({ dropoffFrom: local(9, 23, 10).toISOString(), dropoffUntil: local(10, 0, 10).toISOString() })
    );

    expect(resumed.snappedTimes).toEqual([
      { side: "dropoff", saved: "23:10", selected: "21:30", hour: "21:30" },
    ]);
  });

  it("leaves a time on the list where it was, and says nothing", () => {
    const job = pickupAt(local(7, 14, 30));
    const { resumed, payload } = roundTrip(job);

    expect(resumed.snappedTimes).toEqual([]);
    expect(payload.pickupFrom).toBe(job.pickupFrom);
  });

  it("names a saved window wider than the form's hour, which it narrows", () => {
    // An exact request from before the one-hour window: 09:00–17:00.
    const { resumed, payload } = roundTrip(
      draft({ pickupFrom: local(7, 9).toISOString(), pickupUntil: local(7, 17).toISOString() })
    );

    expect(resumed.snappedTimes).toEqual([
      { side: "pickup", saved: "09:00–17:00", selected: "09:00–10:00", hour: "09:00" },
    ]);
    expect(payload.pickupFrom).toBe(local(7, 9).toISOString());
    expect(payload.pickupUntil).toBe(local(7, 10).toISOString());
  });

  it("has nothing to move in a flexible range", () => {
    const { resumed } = roundTrip(
      draft({ isFlexible: true, pickupFrom: local(7, 6, 15).toISOString(), pickupUntil: local(8, 22).toISOString() })
    );

    expect(resumed.snappedTimes).toEqual([]);
  });
});
