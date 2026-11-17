import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/**
 * Actif / Absent / Suspendu / Désinscrit from the admin's side — §REQ-02 — and
 * what the footer offers per state (driver_page_management_spec.md §2).
 */

// See radix-dialogs-in-jsdom (project memory): the menu needs these.
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

function renderDetail(
  application: CarrierApplication,
  extra: { onSetContactConfirmed?: () => Promise<unknown> } = {}
) {
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
      <CarrierApplicationDetail application={application} isUpdating={false} {...handlers} {...extra} />
    </NextIntlClientProvider>
  );
  return handlers;
}

/** Radix opens a menu from the keyboard in jsdom; a pointerdown it cannot see. */
function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: t.moreActions }), { key: "Enter" });
}
const item = (name: string) => screen.getByRole("menuitem", { name });

describe("CarrierApplicationDetail · what the footer offers", () => {
  it("offers an active driver nothing inline but Close and « Plus d'actions »", () => {
    renderDetail(app());
    expect(screen.getByText(fr.admin.carriers.status.approved)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.close })).toBeInTheDocument();
    for (const name of [t.markAbsent, t.suspend, t.deregister, t.approve, t.reject]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    openMenu();
    expect(item(t.markAbsent)).toBeInTheDocument();
    expect(item(t.suspend)).toBeInTheDocument();
    expect(item(t.deregister)).toBeInTheDocument();
  });

  it("no longer shows « restore access » on a healthy active driver", () => {
    renderDetail(app({ hasDriverAccess: true }));
    expect(screen.queryByRole("button", { name: t.repairAccess })).toBeNull();
    expect(screen.queryByText(t.accessMissingTitle)).toBeNull();
  });

  it("offers « Réparer l'accès » only when an approved driver lacks the role", () => {
    const h = renderDetail(app({ status: "approved", hasDriverAccess: false }));
    expect(screen.getByText(t.accessMissingTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.repairAccess }));
    expect(h.onApprove).toHaveBeenCalledWith("c1");
  });

  it("marks a driver away with no reason and no date", () => {
    const h = renderDetail(app());
    openMenu();
    fireEvent.click(item(t.markAbsent));
    fireEvent.click(screen.getByRole("button", { name: t.confirmAbsent }));
    expect(h.onSetAvailability).toHaveBeenCalledWith({
      id: "c1",
      input: { absent: true, until: null, reason: null },
    });
  });

  it("reads an away driver as « Absent » and offers to end it as the primary action", () => {
    const h = renderDetail(app({ absentSince: new Date().toISOString() }));
    expect(screen.getByText(fr.admin.carriers.status.absent)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.endAbsence }));
    expect(h.onSetAvailability).toHaveBeenCalledWith({ id: "c1", input: { absent: false } });
  });

  it("explains what suspending does, then requires a reason", () => {
    const h = renderDetail(app());
    openMenu();
    fireEvent.click(item(t.suspend));
    expect(screen.getByText(t.suspendHelp)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: t.confirmSuspend });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.suspendReasonLabel), { target: { value: "Retards" } });
    fireEvent.click(confirm);
    expect(h.onSuspend).toHaveBeenCalledWith({ id: "c1", reason: "Retards" });
  });

  it("explains what removing does, and requires a reason to deregister", () => {
    const h = renderDetail(app());
    openMenu();
    fireEvent.click(item(t.deregister));
    expect(screen.getByText(t.removeHelp)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: t.confirmDeregister });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.deregisterReasonLabel), { target: { value: "Fraude" } });
    fireEvent.click(confirm);
    expect(h.onDeregister).toHaveBeenCalledWith({ id: "c1", reason: "Fraude" });
  });

  it.each([
    ["draft", () => t.approve],
    ["rejected", () => t.approveAnyway],
    ["deregistered", () => t.reactivateRemoved],
  ] as const)("lets an admin undo a %s file by approving it directly", (status, label) => {
    const h = renderDetail(app({ status }));
    fireEvent.click(screen.getByRole("button", { name: label() }));
    expect(h.onApprove).toHaveBeenCalledWith("c1");
    expect(screen.queryByRole("button", { name: t.reject })).toBeNull();
    expect(screen.queryByRole("button", { name: t.moreActions })).toBeNull();
  });

  it("keeps Reject visible next to Approve while a file awaits its decision", () => {
    const h = renderDetail(app({ status: "submitted" }));
    expect(screen.getByRole("button", { name: t.approve })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.reject }));
    expect(screen.getByLabelText(t.rejectReasonLabel)).toBeInTheDocument();
    expect(h.onReject).not.toHaveBeenCalled();
  });

  it("reactivates a suspended driver, and keeps « remove » in the menu", () => {
    const h = renderDetail(app({ status: "suspended" }));
    fireEvent.click(screen.getByRole("button", { name: t.reinstate }));
    expect(h.onReinstate).toHaveBeenCalledWith("c1");
  });

  it("offers removal on a suspended driver from the menu", () => {
    renderDetail(app({ status: "suspended" }));
    openMenu();
    expect(item(t.deregister)).toBeInTheDocument();
  });

  it("shows the “applicant reached” tick only while the file waits for a decision", () => {
    const onSetContactConfirmed = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderTick("submitted", onSetContactConfirmed);
    expect(screen.getByText(t.contactConfirmed.label)).toBeInTheDocument();
    unmount();
    renderTick("approved", onSetContactConfirmed);
    expect(screen.queryByText(t.contactConfirmed.label)).toBeNull();
  });

  it("summarises an active driver's runs, rating and fleet", () => {
    renderDetail(app({ completedJobs: 12, averageRating: 4.5, totalRatings: 8 }));
    expect(screen.getByText(t.completedRuns)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("hides banking for an in-house driver", () => {
    renderDetail(app({ kind: "private", siret: null }));
    expect(screen.queryByText(t.banking)).toBeNull();
  });
});

function renderTick(
  status: CarrierApplication["status"],
  onSetContactConfirmed: () => Promise<unknown>
) {
  const handlers = {
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onSuspend: vi.fn(),
    onSetAvailability: vi.fn(),
    onDeregister: vi.fn(),
    onReinstate: vi.fn(),
    onDone: vi.fn(),
    onClose: vi.fn(),
  };
  return render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <CarrierApplicationDetail
        application={app({ status })}
        isUpdating={false}
        onSetContactConfirmed={onSetContactConfirmed}
        {...handlers}
      />
    </NextIntlClientProvider>
  );
}
