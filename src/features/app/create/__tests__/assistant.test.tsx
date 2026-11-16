import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestDraft } from "@/server/dto/request-assistant.dto";
import fr from "../../../../../messages/fr.json";
import { hasFindings, joinSaid } from "../assistant";

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
  });
});
