import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** « Disponibilité » — client_feedback_2026_10_29_spec.md §REQ-02. */

const hooks = vi.hoisted(() => ({
  setAvailability: vi.fn(),
  deregister: vi.fn(),
}));
vi.mock("../../hooks/useCarrier", () => ({
  useSetAvailability: () => ({ mutate: hooks.setAvailability, isPending: false }),
  useDeregister: () => ({ mutate: hooks.deregister, isPending: false }),
}));

import { AvailabilitySection } from "../AvailabilitySection";
import type { CarrierApplication } from "../../api/carrier.api";

const copy = fr.carrier.application.availability;
const app = (over: Partial<CarrierApplication> = {}) =>
  ({
    status: "approved",
    absentSince: null,
    absentUntil: null,
    absenceReason: null,
    ...over,
  }) as CarrierApplication;

const renderCard = (application: CarrierApplication) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <AvailabilitySection application={application} />
    </NextIntlClientProvider>
  );

beforeEach(() => vi.clearAllMocks());

describe("AvailabilitySection", () => {
  it("goes away with no end date when none is picked", () => {
    renderCard(app());
    expect(screen.getByText(copy.active)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: copy.goAway }));
    expect(screen.getByText(copy.absentKeeps)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.confirmAway }));

    expect(hooks.setAvailability).toHaveBeenCalledWith(
      { absent: true, until: null, reason: null },
      expect.anything()
    );
  });

  it("sends the return day as the driver's own midnight", () => {
    renderCard(app());
    fireEvent.click(screen.getByRole("button", { name: copy.goAway }));
    fireEvent.change(screen.getByLabelText(copy.returnDayLabel), { target: { value: "2030-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: copy.confirmAway }));

    expect(hooks.setAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ until: new Date(2030, 0, 15).toISOString() }),
      expect.anything()
    );
  });

  it("offers the way back while away", () => {
    renderCard(app({ absentSince: new Date().toISOString() }));
    expect(screen.getByText(copy.absentOpenEnded)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.back }));
    expect(hooks.setAvailability).toHaveBeenCalledWith({ absent: false });
  });

  it("warns before deregistering, then sends the reason", () => {
    renderCard(app());
    fireEvent.click(screen.getByRole("button", { name: copy.deregister }));
    expect(screen.getByText(copy.deregisterWarning)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(copy.deregisterReasonLabel), { target: { value: "Retraite" } });
    fireEvent.click(screen.getByRole("button", { name: copy.confirmDeregister }));

    expect(hooks.deregister).toHaveBeenCalledWith("Retraite", expect.anything());
  });
});
