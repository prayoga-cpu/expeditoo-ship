import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/**
 * driver_types_spec.md §3: the « chauffeur interne Expeditoo » tick swaps the
 * company questions for the short set, and what is sent says which it is.
 */

const mutate = vi.fn();
vi.mock("../../hooks/useCarrier", () => ({
  useSaveCarrierProfile: () => ({ mutate, isPending: false }),
}));

import { CarrierProfileForm } from "../CarrierProfileForm";

const renderForm = () =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <CarrierProfileForm application={null} />
    </NextIntlClientProvider>
  );

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillContact = () => {
  fireEvent.change(screen.getByPlaceholderText("6 12 34 56 78"), {
    target: { value: "6 12 34 56 78" },
  });
  type("Adresse", "12 rue Exemple");
  type("Ville", "Lyon");
  type("Code postal", "69000");
};

// The Radix checkbox measures itself (radix-dialogs-in-jsdom, project memory).
beforeEach(() => {
  mutate.mockClear();
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("CarrierProfileForm — two kinds of driver", () => {
  it("asks for the company and the SIRET by default", () => {
    renderForm();

    expect(screen.getByLabelText("Raison sociale")).toBeInTheDocument();
    expect(screen.getByLabelText("SIRET")).toBeInTheDocument();
    expect(screen.getByLabelText("Je suis chauffeur interne Expeditoo")).not.toBeChecked();
  });

  it("drops the company questions once the in-house tick is on", () => {
    renderForm();

    fireEvent.click(screen.getByLabelText("Je suis chauffeur interne Expeditoo"));

    expect(screen.queryByLabelText("Raison sociale")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SIRET")).not.toBeInTheDocument();
    expect(screen.getByText("Vos coordonnées")).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse")).toBeInTheDocument();
  });

  it("sends an in-house application with only the contact details", async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Je suis chauffeur interne Expeditoo"));
    fillContact();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith({
      kind: "private",
      contactPhone: "+33 6 12 34 56 78",
      addressLine: "12 rue Exemple",
      city: "Lyon",
      postalCode: "69000",
      bio: undefined,
    });
  });

  it("refuses an outside carrier with no SIRET, and sends nothing", async () => {
    renderForm();
    type("Raison sociale", "Jane Transport");
    fillContact();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Saisissez un SIRET valide (14 chiffres)")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends an outside carrier as professional, with the SIRET normalised", async () => {
    renderForm();
    type("Raison sociale", "Jane Transport");
    type("SIRET", "73282932000074");
    fillContact();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "professional",
        companyName: "Jane Transport",
        siret: "73282932000074",
      })
    );
  });
});
