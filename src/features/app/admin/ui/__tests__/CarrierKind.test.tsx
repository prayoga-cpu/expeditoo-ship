import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { withDriverCopy } from "@/features/app/carrier/ui/__tests__/driver-copy";

/**
 * driver_types_spec.md §1 and §3: wherever the admin sees or picks the kind of
 * a driver it reads « Particulier (interne) » / « Professionnel », and the
 * alert's link opens the file it is about.
 */

beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.setPointerCapture ??= () => {};
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const state = vi.hoisted(() => ({
  applications: [] as unknown[],
  search: "",
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("../../hooks/useCarrierApplications", () => ({
  useCarrierDocumentViewer: () => ({ openDocument: vi.fn(), openingDocId: null }),
  useCarrierApplications: () => ({
    applications: state.applications,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    approveApplication: vi.fn(),
    rejectApplication: vi.fn(),
    suspendCarrierAccount: vi.fn(),
    setAvailability: vi.fn(),
    setContactConfirmed: vi.fn(),
    deregisterCarrierAccount: vi.fn(),
    reinstateCarrierAccount: vi.fn(),
    saveFile: vi.fn(),
    addVehicle: vi.fn(),
    isUpdating: false,
  }),
}));

import { CarrierApplicationsList } from "../CarrierApplicationsList";
import { CarrierFileEditor } from "../CarrierFileEditor";
import type { CarrierApplication } from "../../api/carriers.api";

const app = (over: Partial<CarrierApplication> = {}) =>
  ({
    id: "c1",
    userId: "u1",
    user: { id: "u1", name: "Paul Martin", email: "paul@example.com", image: null },
    kind: "professional",
    companyName: "Paul Martin EI",
    siret: "73282932000074",
    vatNumber: null,
    legalForm: null,
    contactPhone: "0612345678",
    addressLine: "1 rue de Paris",
    city: "Lyon",
    postalCode: "69001",
    status: "submitted",
    ibanLast4: null,
    bicLast4: null,
    rejectionReason: null,
    suspensionReason: null,
    absentSince: null,
    absentUntil: null,
    absenceReason: null,
    deregisteredAt: null,
    deregistrationReason: null,
    averageRating: 0,
    totalRatings: 0,
    completedJobs: 0,
    bio: null,
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    documents: [],
    vehicles: [],
    ...over,
  }) as CarrierApplication;

const inHouse = app({
  id: "c2",
  userId: "u2",
  user: { id: "u2", name: "Jeanne Roux", email: "jeanne@example.com", image: null },
  kind: "private",
  companyName: "Expeditop",
  siret: null,
} as Partial<CarrierApplication>);

function renderWith(node: React.ReactNode, locale: "fr" | "en" = "fr") {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={withDriverCopy(locale === "fr" ? fr : en, locale)}
      timeZone="Europe/Paris"
      onError={onError}
    >
      {node}
    </NextIntlClientProvider>
  );
  return onError;
}

describe("CarrierApplicationsList · the Type column", () => {
  beforeEach(() => {
    state.applications = [app(), inHouse];
    state.search = "";
  });

  it("labels each row with the one vocabulary", () => {
    const onError = renderWith(<CarrierApplicationsList />);

    const paul = screen.getByText("Paul Martin").closest("tr") as HTMLElement;
    const jeanne = screen.getByText("Jeanne Roux").closest("tr") as HTMLElement;
    expect(within(paul).getByText("Professionnel")).toBeInTheDocument();
    expect(within(jeanne).getAllByText("Particulier (interne)").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chauffeur interne Expeditop|Transporteur \(externe\)/)).toBeNull();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("uses the same two words in English", () => {
    renderWith(<CarrierApplicationsList />, "en");

    const paul = screen.getByText("Paul Martin").closest("tr") as HTMLElement;
    const jeanne = screen.getByText("Jeanne Roux").closest("tr") as HTMLElement;
    expect(within(paul).getByText("Professional")).toBeInTheDocument();
    expect(within(jeanne).getAllByText("Private (in-house)").length).toBeGreaterThan(0);
  });

  it("opens nothing by itself without a file in the link", () => {
    renderWith(<CarrierApplicationsList />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("CarrierApplicationsList · the alert's link opens the file", () => {
  beforeEach(() => {
    state.applications = [app(), inHouse];
  });

  it("opens the file named by ?file=, with its type", async () => {
    state.search = "tab=applications&file=c2";
    renderWith(<CarrierApplicationsList />);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText("Jeanne Roux").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Particulier (interne)")).toBeInTheDocument();
  });

  it("stays on the list when the link names a file that is not there", () => {
    state.search = "tab=applications&file=gone";
    renderWith(<CarrierApplicationsList />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Paul Martin")).toBeInTheDocument();
  });
});

describe("CarrierFileEditor · the kind is a radio", () => {
  const renderEditor = (application: CarrierApplication) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onError = renderWith(
      <CarrierFileEditor
        open
        onOpenChange={vi.fn()}
        application={application}
        onSave={onSave}
        onAddVehicle={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );
    return { onSave, onError };
  };

  it("offers the two kinds by the same names, on the file's own", () => {
    const { onError } = renderEditor(app());

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Professionnel" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Particulier (interne)" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByLabelText("SIRET ou numéro d'entreprise")).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("drops the company fields and saves a particulier", async () => {
    const { onSave } = renderEditor(app());

    fireEvent.click(screen.getByRole("radio", { name: "Particulier (interne)" }));
    expect(screen.queryByLabelText("Raison sociale")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le dossier" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: "c1", data: { kind: "private" } });
    expect(onSave.mock.calls[0][0].data).not.toHaveProperty("siret");
  });

  it("locks the choice once the file is approved, and says why", () => {
    renderEditor(app({ status: "approved", kind: "private" } as Partial<CarrierApplication>));

    expect(screen.getByRole("radio", { name: "Particulier (interne)" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Particulier (interne)" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Professionnel" })).toBeDisabled();
    expect(screen.getByText(/ne peut plus changer une fois le dossier approuvé/)).toBeInTheDocument();
  });

  it("no longer caps the postal code at five digits or the company number at digits", () => {
    renderEditor(app());

    expect(screen.getByLabelText("Code postal")).toHaveAttribute("maxlength", "10");
    expect(screen.getByLabelText("SIRET ou numéro d'entreprise")).not.toHaveAttribute("inputmode");
  });
});
