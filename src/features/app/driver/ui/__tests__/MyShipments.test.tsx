import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** « Mes livraisons » — client_feedback_2026_10_29_spec.md §N2, §N5. */

const state = vi.hoisted(() => ({
  shipments: [] as unknown[],
  isError: false,
  roles: ["carrier"] as string[],
}));

vi.mock("../../hooks/useDriverShipments", () => ({
  useDriverShipments: () => ({
    shipments: state.shipments,
    isLoading: false,
    isError: state.isError,
  }),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { roles: state.roles } }),
}));

import { MyShipments } from "../MyShipments";

const run = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "ASSIGNED",
  pickupAddress: "Paris",
  dropoffAddress: "Lyon",
  scheduledPickup: null,
  scheduledDelivery: null,
  pickedUpAt: null,
  deliveredAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  listing: { title },
  ...over,
});

const renderList = () =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <MyShipments />
    </NextIntlClientProvider>
  );

const titles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("MyShipments", () => {
  it("opens soonest first and turns round on request", () => {
    state.shipments = [
      run("late", "Armoire", { scheduledDelivery: "2026-11-20T10:00:00.000Z" }),
      run("soon", "Buffet", { scheduledDelivery: "2026-11-02T10:00:00.000Z" }),
    ];
    renderList();
    expect(titles()).toEqual(["Buffet", "Armoire"]);

    fireEvent.click(screen.getByRole("button", { name: fr.driver.shipments.order.toggle }));
    expect(titles()).toEqual(["Armoire", "Buffet"]);
  });

  it("shows the pickup and delivery dates, done or due", () => {
    state.shipments = [
      run("done", "Commode", {
        status: "DELIVERED",
        pickedUpAt: "2026-10-10T09:00:00.000Z",
        deliveredAt: "2026-10-11T16:00:00.000Z",
      }),
    ];
    renderList();
    expect(screen.getByText(/^Retiré /)).toBeInTheDocument();
    expect(screen.getByText(/^Livré /)).toBeInTheDocument();
  });

  it("links a carrier to « Mes paiements » and keeps pay from a driver-only account", () => {
    state.shipments = [];
    state.roles = ["carrier"];
    const { unmount } = renderList();
    expect(screen.getByRole("link", { name: /Mes paiements/ })).toHaveAttribute("href", "/carrier/withdrawals");
    unmount();

    state.roles = ["driver"];
    renderList();
    expect(screen.queryByRole("link", { name: /Mes paiements/ })).not.toBeInTheDocument();
    state.roles = ["carrier"];
  });

  it("says so when the list cannot be loaded, rather than rendering blank", () => {
    state.isError = true;
    renderList();
    expect(screen.getByText(fr.driver.shipments.error.title)).toBeInTheDocument();
    state.isError = false;
  });
});
