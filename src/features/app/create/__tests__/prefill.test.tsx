import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../messages/fr.json";
import {
  parseRequestPrefill,
  prefillQuery,
  prefillTiming,
  PREFILL_TITLE_MAX,
  PREFILL_TOWN_MAX,
} from "../prefill";

/**
 * landing_2026_11_spec.md §5 — `/create?title=&from=&to=&date=`, what the
 * landing page's search card carries into a new request. Checked once, on the
 * server; a value that fails is dropped, never repaired; a draft never reads
 * it.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/features/app/profile/api/addresses.api", () => ({ createAddress: vi.fn() }));

import { useJobForm } from "../hooks/useJobForm";

/** 10:00 in Paris on Tuesday 24 November 2026. */
const NOW = new Date("2026-11-24T09:00:00Z");

describe("parseRequestPrefill — valid", () => {
  it("keeps the four values", () => {
    expect(
      parseRequestPrefill(
        { title: "Canapé 3 places", from: "Paris", to: "Saint-Étienne", date: "2026-11-30" },
        NOW
      )
    ).toEqual({ title: "Canapé 3 places", from: "Paris", to: "Saint-Étienne", date: "2026-11-30" });
  });

  it("trims and folds whitespace, and keeps the towns people actually write", () => {
    expect(
      parseRequestPrefill(
        { title: "  Une   armoire\n normande ", from: " L'Haÿ-les-Roses ", to: "Paris 9e" },
        NOW
      )
    ).toEqual({ title: "Une armoire normande", from: "L'Haÿ-les-Roses", to: "Paris 9e" });
  });

  it("accepts a town in any script", () => {
    expect(parseRequestPrefill({ to: "Θεσσαλονίκη" }, NOW)).toEqual({ to: "Θεσσαλονίκη" });
  });

  it("reads the first of a repeated parameter", () => {
    expect(parseRequestPrefill({ from: ["Lyon", "Nice"] }, NOW)).toEqual({ from: "Lyon" });
  });

  it("takes today in France, not the server's UTC day", () => {
    // 00:30 in Paris on the 24th is still the 23rd in UTC.
    const justAfterMidnight = new Date("2026-11-23T23:30:00Z");
    expect(parseRequestPrefill({ date: "2026-11-24" }, justAfterMidnight)).toEqual({
      date: "2026-11-24",
    });
    expect(parseRequestPrefill({ date: "2026-11-23" }, justAfterMidnight)).toBeNull();
  });

  it("keeps any subset", () => {
    expect(parseRequestPrefill({ title: "Vélo" }, NOW)).toEqual({ title: "Vélo" });
    expect(parseRequestPrefill({ date: "2026-12-01" }, NOW)).toEqual({ date: "2026-12-01" });
  });
});

describe("parseRequestPrefill — invalid values are dropped, not repaired", () => {
  it("answers null for no prefill at all", () => {
    expect(parseRequestPrefill({}, NOW)).toBeNull();
    expect(parseRequestPrefill({ title: "   ", from: "", to: undefined, date: "" }, NOW)).toBeNull();
  });

  it("drops a date that is not a real day", () => {
    for (const date of ["2026-13-01", "2026-02-30", "30/11/2026", "demain", "2026-11-3"]) {
      expect(parseRequestPrefill({ date }, NOW)).toBeNull();
    }
  });

  it("drops a day already gone, and one more than a year ahead", () => {
    expect(parseRequestPrefill({ date: "2026-11-23" }, NOW)).toBeNull();
    expect(parseRequestPrefill({ date: "2028-01-15" }, NOW)).toBeNull();
    expect(parseRequestPrefill({ date: "2027-11-24" }, NOW)).toEqual({ date: "2027-11-24" });
  });

  it("drops a town that is not a town's name", () => {
    for (const from of ["<script>alert(1)</script>", "Paris; DROP TABLE", "https://evil.test", "-Lyon", "@home"]) {
      expect(parseRequestPrefill({ from }, NOW)).toBeNull();
    }
  });

  it("keeps the good values beside a bad one", () => {
    expect(parseRequestPrefill({ title: "Piano", from: "<b>", date: "nope" }, NOW)).toEqual({
      title: "Piano",
    });
  });

  it("strips control characters from a title", () => {
    expect(parseRequestPrefill({ title: "Piano\u0000droit\u0007" }, NOW)).toEqual({
      title: "Piano droit",
    });
  });
});

describe("parseRequestPrefill — caps", () => {
  it(`cuts a title to the form's ${PREFILL_TITLE_MAX} characters`, () => {
    const long = "é".repeat(PREFILL_TITLE_MAX + 50);
    const prefill = parseRequestPrefill({ title: long }, NOW);
    expect(Array.from(prefill?.title ?? "")).toHaveLength(PREFILL_TITLE_MAX);
  });

  it("never cuts a surrogate pair in half", () => {
    const prefill = parseRequestPrefill({ title: "📦".repeat(PREFILL_TITLE_MAX + 1) }, NOW);
    expect(prefill?.title).toBe("📦".repeat(PREFILL_TITLE_MAX));
  });

  it(`keeps a ${PREFILL_TOWN_MAX}-character town and drops a longer one`, () => {
    const exact = "a".repeat(PREFILL_TOWN_MAX);
    expect(parseRequestPrefill({ to: exact }, NOW)).toEqual({ to: exact });
    expect(parseRequestPrefill({ to: `${exact}a` }, NOW)).toBeNull();
  });
});

describe("prefillQuery", () => {
  it("gives the checked values back, in order, for the sign-in round trip", () => {
    const prefill = parseRequestPrefill(
      { date: "2026-11-30", to: "Lyon", from: "<x>", title: "Piano" },
      NOW
    );
    expect(new URLSearchParams(prefillQuery(prefill)).toString()).toBe(
      "title=Piano&to=Lyon&date=2026-11-30"
    );
  });

  it("gives nothing for no prefill", () => {
    expect(prefillQuery(null)).toEqual({});
  });
});

describe("prefillTiming", () => {
  it("opens the When step on that day, flexible, delivery the day after at the earliest", () => {
    const timing = prefillTiming({ date: "2027-03-10" });
    expect(timing.mode).toBe("flexible");
    expect(timing.pickup.date).toBe("2027-03-10");
    expect(timing.pickup.dateUntil).toBe("2027-03-10");
    expect(timing.dropoff.date >= "2027-03-11").toBe(true);
  });

  it("leaves the form's default when there is no date", () => {
    const timing = prefillTiming({ title: "Piano" });
    expect(timing.pickup.date).not.toBe("");
    expect(timing.mode).toBe("flexible");
  });
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

/** The date `n` days from now, as `YYYY-MM-DD` in local time. */
function dayFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("useJobForm with a prefill", () => {
  it("starts a new request from the card's values: title, towns without pins, the day", () => {
    const date = dayFromNow(5);
    const { result } = renderHook(
      () => useJobForm({ prefill: { title: "Piano droit", from: "Paris", to: "Lyon", date } }),
      { wrapper }
    );

    const values = result.current.form.getValues();
    expect(values.title).toBe("Piano droit");
    expect(values.pickup.city).toBe("Paris");
    expect(values.dropoff.city).toBe("Lyon");
    // A town is not a point: no pin, no street, no postal code invented.
    expect(values.pickup.lat).toBeUndefined();
    expect(values.pickup.address).toBe("");
    expect(values.pickup.postalCode).toBe("");
    expect(values.pickup.locationEntry).toBe("address");
    expect(result.current.timing.mode).toBe("flexible");
    expect(result.current.timing.pickup.date).toBe(date);
    expect(values.isFlexible).toBe(true);
  });

  it("is a blank form without a prefill", () => {
    const { result } = renderHook(() => useJobForm({}), { wrapper });
    const values = result.current.form.getValues();
    expect(values.title).toBe("");
    expect(values.pickup.city).toBe("");
  });

  it("is ignored on a draft: a resumed request keeps what it was saved with", () => {
    const pickup = new Date(Date.now() + 3 * 24 * 3600_000);
    pickup.setHours(9, 0, 0, 0);
    const draft = {
      id: "draft-7",
      reference: 100077,
      shipperId: "requester-1",
      status: "draft",
      jobKind: "items",
      title: "Armoire",
      description: "",
      weightKg: 100,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      quantity: 1,
      isFragile: false,
      needsHelp: false,
      packagingLevel: null,
      needsProtection: false,
      needsPackaging: false,
      pickupAddress: "1 rue A",
      pickupCity: "Nantes",
      pickupPostalCode: "44000",
      pickupCountry: "FR",
      pickupLocationType: "house",
      dropoffAddress: "2 rue B",
      dropoffCity: "Rennes",
      dropoffPostalCode: "35000",
      dropoffCountry: "FR",
      dropoffLocationType: "house",
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
      pickupFrom: pickup.toISOString(),
      pickupUntil: new Date(pickup.getTime() + 3600_000).toISOString(),
      dropoffFrom: new Date(pickup.getTime() + 24 * 3600_000).toISOString(),
      dropoffUntil: new Date(pickup.getTime() + 25 * 3600_000).toISOString(),
      isFlexible: false,
      budgetCents: 4_000,
      origin: "direct",
      photos: [],
    } as never;

    const { result } = renderHook(
      () =>
        useJobForm({
          draft,
          prefill: { title: "Piano", from: "Paris", to: "Lyon", date: dayFromNow(20) },
        }),
      { wrapper }
    );

    const values = result.current.form.getValues();
    expect(values.title).toBe("Armoire");
    expect(values.pickup.city).toBe("Nantes");
    expect(values.dropoff.city).toBe("Rennes");
    expect(result.current.timing.pickup.date).not.toBe(dayFromNow(20));
  });
});
