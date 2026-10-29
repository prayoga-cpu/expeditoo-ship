import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** Actif / Absent / Suspendu / Désinscrit from the admin's side — §REQ-02. */

vi.mock("../../hooks/useCarrierApplications", () => ({
  useCarrierDocumentViewer: () => ({ openDocument: vi.fn(), openingDocId: null }),
}));
vi.mock("@/components/ui/dialog", () => ({
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { CarrierApplicationDetail } from "../CarrierApplicationDetail";
import type { CarrierApplication } from "../../api/carriers.api";

const t = fr.admin.carriers.detail;
const app = (over: Partial<CarrierApplication> = {}) =>
  ({
    id: "c1",
    userId: "u1",
    user: { id: "u1", name: "Paul Martin", email: "paul@example.com", image: null },
    companyName: "Paul Martin EI",
    siret: "73282932000074",
    vatNumber: null,
    legalForm: null,
    contactPhone: "0612345678",
    addressLine: "1 rue de Paris",
    city: "Lyon",
    postalCode: "69001",
    status: "approved",
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

function renderDetail(application: CarrierApplication) {
  const handlers = {
    onApprove: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
    onSuspend: vi.fn().mockResolvedValue(undefined),
    onSetAvailability: vi.fn().mockResolvedValue(undefined),
    onDeregister: vi.fn().mockResolvedValue(undefined),
    onReinstate: vi.fn().mockResolvedValue(undefined),
    onDone: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <CarrierApplicationDetail application={application} isUpdating={false} {...handlers} />
    </NextIntlClientProvider>
  );
  return handlers;
}

describe("CarrierApplicationDetail · availability", () => {
  it("reads an approved driver as « Actif » and offers away, suspend and deregister", () => {
    renderDetail(app());
    expect(screen.getByText(fr.admin.carriers.status.approved)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.markAbsent })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.suspend })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.deregister })).toBeInTheDocument();
  });

  it("marks a driver away with no reason and no date", () => {
    const h = renderDetail(app());
    fireEvent.click(screen.getByRole("button", { name: t.markAbsent }));
    fireEvent.click(screen.getByRole("button", { name: t.confirmAbsent }));
    expect(h.onSetAvailability).toHaveBeenCalledWith({
      id: "c1",
      input: { absent: true, until: null, reason: null },
    });
  });

  it("reads an away driver as « Absent » and offers to end it", () => {
    const h = renderDetail(app({ absentSince: new Date().toISOString() }));
    expect(screen.getByText(fr.admin.carriers.status.absent)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.endAbsence }));
    expect(h.onSetAvailability).toHaveBeenCalledWith({ id: "c1", input: { absent: false } });
  });

  it("requires a reason to deregister", () => {
    const h = renderDetail(app());
    fireEvent.click(screen.getByRole("button", { name: t.deregister }));
    const confirm = screen.getByRole("button", { name: t.confirmDeregister });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.deregisterReasonLabel), { target: { value: "Fraude" } });
    fireEvent.click(confirm);
    expect(h.onDeregister).toHaveBeenCalledWith({ id: "c1", reason: "Fraude" });
  });

  it("offers to reinstate a suspended driver", () => {
    const h = renderDetail(app({ status: "suspended" }));
    fireEvent.click(screen.getByRole("button", { name: t.reinstate }));
    expect(h.onReinstate).toHaveBeenCalledWith("c1");
  });
});
