import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../messages/fr.json";

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
vi.mock("../api/jobs.api", () => ({ jobsApi: { create: (...a: unknown[]) => create(...a) } }));

import { useJobForm } from "../hooks/useJobForm";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
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
