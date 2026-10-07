import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, createTranslator, type Messages } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/fetcher";
import fr from "../../../../../messages/fr.json";

/**
 * Catalogue text by its path, resolved the way the hook resolves it — so a
 * key this release adds reads the same here as in the toast it is checked
 * against, with or without its catalogue entry yet.
 */
const tr = createTranslator({
  locale: "fr",
  messages: fr as Messages,
  onError: () => {},
});

/**
 * The form's own flow (publication_timing_spec.md §3.5): what a button pressed
 * on one step does when the problem lies on another. The network, the router
 * and the toasts are stood in for; the schema and the hook are real.
 */

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

const createAddress = vi.fn();
vi.mock("@/features/app/profile/api/addresses.api", () => ({
  createAddress: (...a: unknown[]) => createAddress(...a),
}));

const create = vi.fn();
const saveDraft = vi.fn();
vi.mock("../api/jobs.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/jobs.api")>()),
  jobsApi: {
    create: (...a: unknown[]) => create(...a),
    saveDraft: (...a: unknown[]) => saveDraft(...a),
  },
}));

import { useJobForm } from "../hooks/useJobForm";

/** The provider tree, around a client the test can look into. */
const withClient =
  (client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

function wrapper({ children }: { children: ReactNode }) {
  return withClient()({ children });
}

const endpoint = (over: Record<string, unknown> = {}) => ({
  address: "12 rue de la République",
  city: "Lyon",
  postalCode: "69002",
  locationType: "house" as const,
  note: "",
  contactName: "",
  contactPhone: "+33612345678",
  saveAddress: false,
  addressLabel: "",
  ...over,
});

type Form = ReturnType<typeof useJobForm>;

/** Fill « Quoi » and press « Suivant », then fill « Où ». */
async function reachWhere(result: { current: Form }, pickup = endpoint()) {
  act(() => {
    const { form } = result.current;
    form.setValue("title", "Canapé deux places");
    form.setValue("description", "Un canapé, rez-de-chaussée des deux côtés.");
    form.setValue("weightBracket", "upTo100");
  });
  await act(() => result.current.handleNext());
  expect(result.current.currentStep).toBe(1);
  act(() => {
    result.current.form.setValue("pickup", pickup);
    result.current.form.setValue(
      "dropoff",
      endpoint({ address: "3 rue Paradis", city: "Marseille", postalCode: "13001" })
    );
  });
}

beforeEach(() => {
  createAddress.mockResolvedValue({});
  create.mockResolvedValue({ id: "job-1", status: "draft" });
  saveDraft.mockResolvedValue({ id: "draft-7", status: "open" });
});

describe("useJobForm — a submit from an earlier step", () => {
  it("walks on one step instead of skipping « Quand » unseen", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result);

    // The only error is the budget, two steps ahead.
    await act(() => result.current.saveDraft());

    await waitFor(() => expect(result.current.currentStep).toBe(2));
    expect(toastError).toHaveBeenCalledWith(fr.create.toast.finishSteps);
    expect(create).not.toHaveBeenCalled();
  });

  it("saves an address ticked on « Où » on the way", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result, endpoint({ saveAddress: true }));

    await act(() => result.current.saveDraft());

    await waitFor(() => expect(createAddress).toHaveBeenCalledTimes(1));
  });

  it("goes back, naming the step, to an error on a step already seen", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result);
    await act(() => result.current.handleNext());
    await act(() => result.current.handleNext());
    expect(result.current.currentStep).toBe(3);

    // A budget is given, then the title on « Quoi » is emptied.
    act(() => {
      result.current.form.setValue("budgetEuros", 40);
      result.current.form.setValue("title", "");
    });
    await act(() => result.current.saveDraft());

    await waitFor(() => expect(result.current.currentStep).toBe(0));
    expect(toastError).toHaveBeenCalledWith("Vérifiez l'étape « Quoi ».");
  });

  it("saves an address ticked after coming back to « Où », with the draft", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result);
    await act(() => result.current.handleNext());
    await act(() => result.current.handleNext());
    act(() => result.current.form.setValue("budgetEuros", 40));

    // Back to « Où », where « Enregistrer cette adresse » is ticked now.
    act(() => result.current.handlePrev());
    act(() => result.current.handlePrev());
    act(() => result.current.form.setValue("pickup.saveAddress", true));
    await act(() => result.current.saveDraft());

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(createAddress).toHaveBeenCalledTimes(1);
    // A draft: saved, told so, sent to the list.
    expect(create.mock.calls[0][1]).toBe(false);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/listings/me"));
  });

  it("lands a published request on its thank-you page", async () => {
    create.mockResolvedValue({ id: "job-9", status: "open" });
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result);
    await act(() => result.current.handleNext());
    await act(() => result.current.handleNext());
    act(() => result.current.form.setValue("budgetEuros", 40));

    await act(() => result.current.publish());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/create/success/job-9"));
    // The page says it; no toast does.
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("useJobForm — never twice, never the long way round", () => {
  it("posts once however fast the button is pressed twice", async () => {
    let answer: (value: unknown) => void = () => {};
    create.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result);
    await act(() => result.current.handleNext());
    await act(() => result.current.handleNext());
    act(() => result.current.form.setValue("budgetEuros", 40));

    await act(async () => {
      void result.current.saveDraft();
      void result.current.saveDraft();
    });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => answer({ id: "job-1", status: "draft" }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("saves a ticked address once when two saves overlap", async () => {
    let answer: (value: unknown) => void = () => {};
    createAddress.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result, endpoint({ saveAddress: true }));

    // « Suivant » and « Enregistrer le brouillon » while the save is pending.
    await act(async () => {
      void result.current.handleNext();
      void result.current.saveDraft();
    });
    await act(async () => answer({}));

    expect(createAddress).toHaveBeenCalledTimes(1);
  });

  it("goes on from the furthest step reached, not from where the requester went back to", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result);
    await act(() => result.current.handleNext());
    expect(result.current.currentStep).toBe(2);

    // Back to « Quoi » to change the title, then « Enregistrer le brouillon ».
    act(() => result.current.handlePrev());
    act(() => result.current.handlePrev());
    act(() => result.current.form.setValue("title", "Canapé trois places"));
    await act(() => result.current.saveDraft());

    // Straight to « Budget », the first step not yet reached.
    await waitFor(() => expect(result.current.currentStep).toBe(3));
  });
});

// draft_requests_spec.md §2–§3
describe("useJobForm — finishing a saved request", () => {
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  tomorrow.setHours(9, 0, 0, 0);
  const until = new Date(tomorrow.getTime() + 3600_000);
  const delivery = new Date(tomorrow.getTime() + 24 * 3600_000);

  const saved = {
    id: "draft-7",
    reference: 100077,
    shipperId: "requester-1",
    status: "draft",
    title: "Canapé deux places",
    description: "Un canapé, rez-de-chaussée des deux côtés.",
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
    ...Object.fromEntries(
      Object.entries(endpoint()).map(([k, v]) => [`pickup${k[0].toUpperCase()}${k.slice(1)}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(endpoint({ address: "3 rue Paradis", city: "Marseille", postalCode: "13001" })).map(
        ([k, v]) => [`dropoff${k[0].toUpperCase()}${k.slice(1)}`, v]
      )
    ),
    pickupLat: null,
    pickupLng: null,
    dropoffLat: null,
    dropoffLng: null,
    pickupFloor: null,
    pickupHasLift: null,
    dropoffFloor: null,
    dropoffHasLift: null,
    pickupFrom: tomorrow.toISOString(),
    pickupUntil: until.toISOString(),
    dropoffFrom: delivery.toISOString(),
    dropoffUntil: new Date(delivery.getTime() + 3600_000).toISOString(),
    isFlexible: false,
    budgetCents: 4_000,
    acceptedOfferId: null,
    origin: "direct",
    offersCount: 0,
    views: 0,
    expiresAt: tomorrow.toISOString(),
    reopenedAt: null,
    scheduledPublishAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    photos: [],
  } as never;

  it("opens on the Budget step with every step already reached", () => {
    const { result } = renderHook(
      () => useJobForm({ draft: saved, startStep: 3 }),
      { wrapper }
    );

    expect(result.current.currentStep).toBe(3);
    expect(result.current.isResuming).toBe(true);
    expect(result.current.form.getValues("title")).toBe("Canapé deux places");
    expect(String(result.current.form.getValues("budgetEuros"))).toBe("40");
  });

  it("publishes it with PUT, onto the same request, and thanks the requester", async () => {
    const { result } = renderHook(
      () => useJobForm({ draft: saved, startStep: 3 }),
      { wrapper }
    );

    await act(() => result.current.publish());

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(saveDraft.mock.calls[0][0]).toBe("draft-7");
    expect(saveDraft.mock.calls[0][2]).toBe(true);
    expect(create).not.toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/create/success/draft-7"));
  });

  // A time saved by the form before the half-hour list: 09:15.
  const quarterPast = new Date(tomorrow);
  quarterPast.setMinutes(15);
  const savedAtQuarterPast = {
    ...(saved as object),
    pickupFrom: quarterPast.toISOString(),
    pickupUntil: new Date(quarterPast.getTime() + 3600_000).toISOString(),
  } as never;

  it("opens on the When step, not the one asked for, when a saved time had to move", () => {
    const { result } = renderHook(
      () => useJobForm({ draft: savedAtQuarterPast, startStep: 3, publishNow: true }),
      { wrapper }
    );

    expect(result.current.currentStep).toBe(2);
    expect(result.current.snappedTimes).toEqual([
      { side: "pickup", saved: "09:15", selected: "09:30", hour: "09:30" },
    ]);
  });

  // An exact request saved before the one-hour window: 09:00–17:00.
  const savedAllDay = {
    ...(saved as object),
    pickupFrom: tomorrow.toISOString(),
    pickupUntil: new Date(tomorrow.getTime() + 8 * 3600_000).toISOString(),
  } as never;

  it("says so, too, when the form narrows a saved window to its one hour", () => {
    const { result } = renderHook(
      () => useJobForm({ draft: savedAllDay, startStep: 3 }),
      { wrapper }
    );

    expect(result.current.currentStep).toBe(2);
    expect(result.current.snappedTimes).toEqual([
      { side: "pickup", saved: "09:00–17:00", selected: "09:00–10:00", hour: "09:00" },
    ]);

    const { timing } = result.current;
    act(() => result.current.handleTimingChange({ ...timing, pickup: { ...timing.pickup, hour: "10:00" } }));
    expect(result.current.snappedTimes).toEqual([]);
  });

  it("stops saying so once the requester picks a time themselves", () => {
    const { result } = renderHook(() => useJobForm({ draft: savedAtQuarterPast }), { wrapper });

    const { timing } = result.current;
    act(() => result.current.handleTimingChange({ ...timing, pickup: { ...timing.pickup, hour: "10:00" } }));

    expect(result.current.snappedTimes).toEqual([]);
  });

  it("opens where it was asked to when every saved time is on the list", () => {
    const { result } = renderHook(() => useJobForm({ draft: saved, startStep: 3 }), { wrapper });

    expect(result.current.snappedTimes).toEqual([]);
    expect(result.current.currentStep).toBe(3);
  });

  it("says a request deleted meanwhile is gone, never to try again, and keeps the form", async () => {
    saveDraft.mockRejectedValue(new ApiError("LISTING_NOT_FOUND", "Listing not found", 404));
    const { result } = renderHook(() => useJobForm({ draft: saved, startStep: 3 }), { wrapper });

    await act(() => result.current.publish());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(tr("myJobs.draft.notFound")));
    expect(toastError).not.toHaveBeenCalledWith(fr.create.toast.failed);
    expect(replace).not.toHaveBeenCalled();
  });

  it("says a request published or closed meanwhile can no longer change, and hands over to its fresh page", async () => {
    saveDraft.mockRejectedValue(new ApiError("LISTING_NOT_DRAFT", "Listing is not a draft", 409));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(["job", "draft-7"], { id: "draft-7", status: "scheduled" });
    const { result } = renderHook(() => useJobForm({ draft: saved, startStep: 3 }), {
      wrapper: withClient(client),
    });

    await act(() => result.current.publish());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/listing/draft-7"));
    expect(toastError).toHaveBeenCalledWith(tr("myJobs.draft.noLongerEditable"));
    // Its page would otherwise show the copy read under a minute ago.
    expect(client.getQueryState(["job", "draft-7"])?.isInvalidated).toBe(true);
  });
});


describe("useJobForm — saved addresses (saved_addresses_spec.md)", () => {
  const home = {
    id: "home",
    label: "home",
    street: "Voie du Loup",
    city: "Saleux",
    zip: "80480",
    country: "France",
    isDefault: false,
    lat: 49.86,
    lng: 2.24,
    usedFor: null,
  };

  beforeEach(() => {
    toastError.mockClear();
    createAddress.mockClear();
  });

  // The owner's report: « Suivant » did nothing and said nothing.
  it("says why « Suivant » did not move when both ends are the same address", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result);
    act(() => result.current.form.setValue("dropoff", endpoint()));

    await act(() => result.current.handleNext());

    expect(result.current.currentStep).toBe(1);
    expect(toastError).toHaveBeenCalledWith(tr("create.toast.sameAddress"));
  });

  it("saves a ticked address for the end it was typed at, under its preset", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result, endpoint({ saveAddress: true, addressLabel: "work" }));

    await act(() => result.current.handleNext());

    await waitFor(() => expect(createAddress).toHaveBeenCalledTimes(1));
    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({ label: "work", usedFor: "pickup", city: "Lyon" })
    );
  });

  it("names an address saved without a name after its town", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });
    await reachWhere(result, endpoint({ saveAddress: true }));

    await act(() => result.current.handleNext());

    await waitFor(() =>
      expect(createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ label: "Lyon", usedFor: "pickup" })
      )
    );
  });

  it("fills a fresh request once, so an end cleared by hand stays clear", async () => {
    const { result } = renderHook(() => useJobForm(), { wrapper });

    act(() => result.current.prefillAddresses([home]));
    expect(result.current.form.getValues("pickup.address")).toBe("Voie du Loup");
    expect(result.current.form.getValues("dropoff.address")).toBe("");

    // « Saisir une nouvelle adresse », then « Où » mounts again.
    act(() => result.current.form.setValue("pickup.address", ""));
    act(() => result.current.prefillAddresses([home]));

    expect(result.current.form.getValues("pickup.address")).toBe("");
  });
});
