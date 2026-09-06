import type { ShipmentStatus } from "./api/deliveries.api";
import type {
  CancellationCategory,
  CancellationSide,
} from "@/lib/cancellation-policy";

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

/**
 * The client's attestation of a step, where one is asked for. Null on the
 * steps §4 of transport_status_confirmation_spec.md excludes — a client
 * witnesses neither the assignment nor the departure, so there is nothing to
 * be waiting for on those.
 */
export interface TimelineConfirmation {
  state: "confirmed" | "awaiting";
  channel: "expedion_app" | "link" | null;
  /** Who answered — an operator's answer must not read as the client's. */
  role: "client" | "operator";
  date: string | null;
}

export interface TimelineStep {
  status: ShipmentStatus;
  label: string;
  date: string;
  note: string | null;
  step: TimelineStepStatus;
  confirmation: TimelineConfirmation | null;
}

export interface DeliveryDetailView {
  id: string;
  listingId: string;
  title: string;
  status: ShipmentStatus;
  /** Null when the viewer is not a party — an operator or admin looking on. */
  role: DeliveryRole | null;
  priceCents?: number;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledPickup: string | null;
  scheduledDelivery: string | null;
  deliveredAt: string | null;
  cancellationReason: string | null;
  /** Which side stopped it, and why — null on a run that is still live. */
  cancelledBySide: CancellationSide | null;
  cancellationCategory: CancellationCategory | null;
  carrier: { id: string; name: string; image: string | null };
  driver: { id: string; name: string; image: string | null } | null;
  shipper: { id: string; name: string; image: string | null };
  /** Who the contact button reaches, relative to the viewer. */
  counterpart: { id: string; name: string; image: string | null };
  timeline: TimelineStep[];
  canCancel: boolean;
}
