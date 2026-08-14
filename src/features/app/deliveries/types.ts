import type { ShipmentStatus } from "./api/deliveries.api";

/** View models for the shipper-side tracking surface. */

export type DeliveryTab = "active" | "past";

/** What the viewer is to this shipment; drives labels and actions. */
export type DeliveryRole = "shipper" | "carrier" | "driver";

export interface DeliverySummaryView {
  id: string;
  title: string;
  status: ShipmentStatus;
  pickupAddress: string;
  dropoffAddress: string;
  /** Undefined when the service stripped it (driver viewer). */
  priceCents?: number;
  /** The other party's name, relative to the viewer. */
  counterpartName: string;
  dateLabel: string;
}

export type TimelineStepStatus = "completed" | "active" | "pending";

export interface TimelineStep {
  status: ShipmentStatus;
  label: string;
  date: string;
  note: string | null;
  step: TimelineStepStatus;
}

export interface DeliveryDetailView {
  id: string;
  listingId: string;
  title: string;
  status: ShipmentStatus;
  role: DeliveryRole;
  priceCents?: number;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledPickup: string | null;
  scheduledDelivery: string | null;
  deliveredAt: string | null;
  cancellationReason: string | null;
  proofOfDeliveryUrl: string | null;
  carrier: { id: string; name: string; image: string | null };
  driver: { id: string; name: string; image: string | null } | null;
  shipper: { id: string; name: string; image: string | null };
  /** Who the contact button reaches, relative to the viewer. */
  counterpart: { id: string; name: string; image: string | null };
  timeline: TimelineStep[];
  canCancel: boolean;
}
