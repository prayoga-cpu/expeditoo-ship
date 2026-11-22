import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The button that ends a run read « Marquer livrée sans photo ». It never
 * delivered without one: `→ DELIVERED` is refused by the service until a
 * delivery photo exists (shipment_photos_spec.md §3.6,
 * `DELIVERY_PHOTO_REQUIRED`, staff included), and this component disables the
 * button until then. The label was the defect — it promised a lane that does
 * not exist — and is now « Confirmer la livraison » in the catalogue. What is
 * pinned here is the behaviour the label has to match.
 */

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => `${namespace}.${key}`,
}));

const mutate = vi.fn();
vi.mock("../../hooks/useDriverShipments", () => ({
  useAssignSelfToShipment: () => ({ mutate: vi.fn(), isPending: false, canAssign: true }),
  useUpdateShipmentStatus: () => ({ mutate, isPending: false }),
  useWithdrawFromJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const photos = vi.hoisted(() => ({ pickup: [] as unknown[], delivery: [] as unknown[] }));
vi.mock("@/features/app/common/hooks/useShipmentPhotos", () => ({
  useShipmentPhotos: () => photos,
}));

vi.mock("@/features/app/common/ui/ShipmentPhotoCapture", () => ({
  ShipmentPhotoCapture: ({ stage }: { stage: string }) => (
    <div data-testid={`capture-${stage}`} />
  ),
  PhotoRequirementNotice: ({ show }: { show: boolean }) =>
    show ? <p data-testid="photo-required" /> : null,
}));
vi.mock("@/features/app/common/ui/ShipmentPhotoGallery", () => ({
  ShipmentPhotoGallery: () => null,
}));
vi.mock("@/features/app/common/ui/StopTransportDialog", () => ({
  StopTransportDialog: () => null,
}));

import { ShipmentActions } from "../ShipmentActions";

const shipment = {
  id: "s1",
  status: "IN_TRANSIT" as const,
  pickupAddress: "1 rue de la Gare, Caen",
  dropoffAddress: "2 place du Marché, Rennes",
};

const deliver = () =>
  screen.getByRole("button", { name: "driver.actions.markDelivered" });

beforeEach(() => {
  mutate.mockClear();
  photos.pickup = [];
  photos.delivery = [];
});

describe("ShipmentActions — delivering", () => {
  it("cannot be confirmed without a delivery photo, and says a photo is needed", () => {
    render(<ShipmentActions shipment={shipment} />);

    expect(deliver()).toBeDisabled();
    expect(screen.getByTestId("photo-required")).toBeInTheDocument();
    // The way forward is on the same screen: the capture for this stage.
    expect(screen.getByTestId("capture-delivery")).toBeInTheDocument();

    fireEvent.click(deliver());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("is confirmed once a delivery photo exists", () => {
    photos.delivery = [{ id: "p1" }];
    render(<ShipmentActions shipment={shipment} />);

    expect(deliver()).toBeEnabled();
    expect(screen.queryByTestId("photo-required")).toBeNull();

    fireEvent.click(deliver());
    expect(mutate).toHaveBeenCalledWith({ status: "DELIVERED" });
  });

  it("offers no second button that skips the photo", () => {
    render(<ShipmentActions shipment={shipment} />);

    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["driver.actions.markDelivered"]);
  });
});
