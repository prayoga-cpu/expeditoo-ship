import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import { withDriverCopy } from "./driver-copy";
import type { CarrierApplication } from "../../api/carrier.api";

/**
 * driver_types_spec.md §3 and §8: « Particulier » or « Professionnel » is a
 * radio at the top of the form, what is sent says which it is, and a
 * professional registered outside France can fill the form in.
 */

const mutate = vi.fn();
vi.mock("../../hooks/useCarrier", () => ({
  useSaveCarrierProfile: () => ({ mutate, isPending: false }),
}));

import { CarrierProfileForm } from "../CarrierProfileForm";

const PRIVATE = "Particulier — chauffeur interne Expeditop";
const PROFESSIONAL = "Professionnel — transporteur";
const COMPANY_NUMBER = "SIRET ou numéro d'entreprise";

const renderForm = (application: CarrierApplication | null = null) => {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale="fr" messages={withDriverCopy(fr, "fr")} onError={onError}>
      <CarrierProfileForm application={application} />
    </NextIntlClientProvider>
  );
  return onError;
};

const file = (over: Partial<CarrierApplication>) =>
  ({
    kind: "professional",
    status: "draft",
    companyName: "Jane Transport",
    siret: "73282932000074",
    vatNumber: null,
    legalForm: null,
    contactPhone: "+33 6 12 34 56 78",
    addressLine: "12 rue Exemple",
    city: "Lyon",
    postalCode: "69000",
    ...over,
  }) as CarrierApplication;

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillContact = (phone = "06 12 34 56 78", postalCode = "69000") => {
  type("Téléphone de contact", phone);
  type("Adresse", "12 rue Exemple");
  type("Ville", "Lyon");
  type("Code postal", postalCode);
};

const save = () => fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

// The Radix radio measures itself (radix-dialogs-in-jsdom, project memory).
beforeEach(() => {
  mutate.mockClear();
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("CarrierProfileForm — the kind is a radio", () => {
  it("offers the two kinds as a radio group, professional by default", () => {
    const onError = renderForm();

    expect(screen.getByRole("radiogroup", { name: "Vous êtes…" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: PROFESSIONAL })).toBeChecked();
    expect(screen.getByRole("radio", { name: PRIVATE })).not.toBeChecked();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("says in one line what each kind involves", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: PRIVATE })).toHaveAccessibleDescription(
      /Ni société, ni documents, ni RIB\. Expeditop vous attribue vos courses\./
    );
    expect(screen.getByRole("radio", { name: PROFESSIONAL })).toHaveAccessibleDescription(
      /Société, numéro d'entreprise, documents et RIB\. Vous faites vos offres/
    );
  });

  it("asks a professional for the company and its number", () => {
    renderForm();

    expect(screen.getByLabelText("Raison sociale")).toBeInTheDocument();
    expect(screen.getByLabelText(COMPANY_NUMBER)).toBeInTheDocument();
  });

  it("drops the company questions for a particulier", () => {
    const onError = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: PRIVATE }));

    expect(screen.getByRole("radio", { name: PRIVATE })).toBeChecked();
    expect(screen.queryByLabelText("Raison sociale")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(COMPANY_NUMBER)).not.toBeInTheDocument();
    expect(screen.getByText("Vos coordonnées")).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse")).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("opens on the kind the file already has", () => {
    renderForm(file({ kind: "private" }));

    expect(screen.getByRole("radio", { name: PRIVATE })).toBeChecked();
    expect(screen.queryByLabelText("Raison sociale")).not.toBeInTheDocument();
  });

  it("lets a draft switch kind, with no sentence about a lock", () => {
    renderForm(file({ status: "draft" }));

    expect(screen.getByRole("radio", { name: PRIVATE })).toBeEnabled();
    expect(screen.queryByText(/ne peut plus changer/)).not.toBeInTheDocument();
  });

  it.each(["approved", "suspended"] as const)(
    "shows the choice read-only, and why, once the file is %s",
    (status) => {
      renderForm(file({ kind: "private", status }));

      expect(screen.getByRole("radio", { name: PRIVATE })).toBeChecked();
      expect(screen.getByRole("radio", { name: PRIVATE })).toBeDisabled();
      expect(screen.getByRole("radio", { name: PROFESSIONAL })).toBeDisabled();
      expect(
        screen.getByText(/Le type ne peut plus changer une fois le dossier approuvé/)
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: PROFESSIONAL }));
      expect(screen.getByRole("radio", { name: PRIVATE })).toBeChecked();
    }
  );
});

describe("CarrierProfileForm — what is sent", () => {
  it("sends a particulier with only the contact details", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: PRIVATE }));
    fillContact();

    save();

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

  it("refuses a professional with no company number, and sends nothing", async () => {
    renderForm();
    type("Raison sociale", "Jane Transport");
    fillContact();

    save();

    expect(
      await screen.findByText(/Saisissez un SIRET \(14 chiffres\) ou un numéro d'entreprise/)
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends a French professional with the SIRET normalised", async () => {
    renderForm();
    type("Raison sociale", "Jane Transport");
    type(COMPANY_NUMBER, "732 829 320 00074");
    fillContact();

    save();

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "professional",
        companyName: "Jane Transport",
        siret: "73282932000074",
        contactPhone: "+33 6 12 34 56 78",
      })
    );
  });

  it("groups a SIRET 3-3-3-5 on leaving the field, and leaves a foreign number alone", () => {
    renderForm();
    const field = screen.getByLabelText(COMPANY_NUMBER);

    fireEvent.change(field, { target: { value: "73282932000074" } });
    fireEvent.blur(field);
    expect(field).toHaveValue("732 829 320 00074");

    fireEvent.change(field, { target: { value: "BE 0123.456.789" } });
    fireEvent.blur(field);
    expect(field).toHaveValue("BE 0123.456.789");
  });
});

describe("CarrierProfileForm — a professional outside France", () => {
  it("has no fixed +33 prefix on the phone, and no five-character cap on the postal code", () => {
    renderForm();

    expect(screen.queryByText(/\+33/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Téléphone de contact")).toHaveValue("");
    expect(screen.getByLabelText("Code postal")).toHaveAttribute("maxlength", "10");
    expect(screen.getByLabelText(COMPANY_NUMBER)).not.toHaveAttribute("inputmode");
  });

  it("sends a Belgian carrier's number, VAT, phone and postal code", async () => {
    renderForm();
    type("Raison sociale", "Transports Peeters SRL");
    type(COMPANY_NUMBER, "BE 0123.456.789");
    type(/Numéro de TVA/, "be 0123 456 789");
    fillContact("+32 470 12 34 56", "1000");

    save();

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "professional",
        siret: "BE0123456789",
        vatNumber: "BE0123456789",
        contactPhone: "+32470123456",
        postalCode: "1000",
      })
    );
  });

  it("refuses a phone with neither a French form nor a country code", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: PRIVATE }));
    fillContact("470 12 34 56");

    save();

    expect(
      await screen.findByText(/numéro international avec son indicatif/)
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("refuses a postal code of two characters", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: PRIVATE }));
    fillContact("06 12 34 56 78", "12");

    save();

    expect(await screen.findByText("3 à 10 lettres ou chiffres")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
});
