import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../messages/fr.json";

/**
 * The owner's « 040 », on the field it was reported on: the Budget step of
 * `/create`, rendered by the real `JobForm` over the real `useJobForm`
 * (numeric_input_spec.md §1). The network, the router and the toasts are stood
 * in for, as in `useJobForm.test.tsx`.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/features/app/profile/api/addresses.api", () => ({
  createAddress: vi.fn(),
  fetchAddresses: vi.fn(),
}));
vi.mock("../api/jobs.api", () => ({ jobsApi: { create: vi.fn() } }));

import { useJobForm, type JobFormApi } from "../hooks/useJobForm";
import { JobForm } from "../ui/JobForm";

let api: JobFormApi;

/** The form as the page builds it, opened on « Budget ». */
function BudgetPage() {
  api = useJobForm();
  return <JobForm {...api} currentStep={3} isFirstStep={false} isLastStep />;
}

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

const budgetBox = () =>
  screen.getByLabelText(fr.create.budget.label, { exact: false }) as HTMLInputElement;

describe("the Budget step", () => {
  it("leaves « 40 » for « 040 », held as the text the box shows", () => {
    render(<BudgetPage />, { wrapper });

    fireEvent.change(budgetBox(), { target: { value: "040" } });

    expect(budgetBox().value).toBe("40");
    expect(api.form.getValues("budgetEuros")).toBe("40");
  });

  it("writes cents the French way, whichever separator was typed", () => {
    render(<BudgetPage />, { wrapper });

    fireEvent.change(budgetBox(), { target: { value: "40.5" } });

    expect(budgetBox().value).toBe("40,5");
    expect(api.form.getValues("budgetEuros")).toBe("40,5");
  });

  it("starts blank, so the When step's rules still run before it is typed", () => {
    render(<BudgetPage />, { wrapper });

    // CLAUDE.md gotcha 15: never unset.
    expect(budgetBox().value).toBe("");
    expect(api.form.getValues("budgetEuros")).toBe("");
  });

  it("says what the server would have refused, on the field", async () => {
    render(<BudgetPage />, { wrapper });
    fireEvent.change(budgetBox(), { target: { value: "0,50" } });

    await act(async () => {
      await api.form.trigger("budgetEuros");
    });

    expect(api.form.formState.errors.budgetEuros?.message).toBe(
      "create.validation.budgetMin"
    );
  });
});
