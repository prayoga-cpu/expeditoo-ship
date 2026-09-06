"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import {
  deliveriesApi,
  type ShipmentEvent,
  type ShipmentStatus,
  type ShipmentWithEvents,
} from "../api/deliveries.api";
import type {
  DeliveryDetailView,
  DeliveryRole,
  TimelineConfirmation,
  TimelineStep,
} from "../types";
import { canCancelAs } from "@/lib/cancellation-policy";
import { deliveryKeys } from "./useDeliveries";

/** The two steps the client is asked to attest. */
const ATTESTABLE = ["PICKED_UP", "DELIVERED"] as const;

export function useDeliveryDetail(id: string) {
  const t = useTranslations("deliveries");
  const stop = useTranslations("shipments.stop");
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: deliveryKeys.detail(id),
    queryFn: () => deliveriesApi.getById(id),
    enabled: Boolean(id),
  });

  const delivery: DeliveryDetailView | null =
    data && user ? toDetailView(data, user.id, t, stop) : null;

  return {
    delivery,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : null,
  };
}

/**
 * What the viewer is to this shipment.
 *
 * `null` for anyone who is not a party — an operator, support, or an admin
 * looking at somebody else's run. It used to fall through to `"shipper"`, which
 * showed staff the client's wording and, worse, the client's cancel button.
 */
function roleFor(
  shipment: ShipmentWithEvents,
  viewerId: string
): DeliveryRole | null {
  if (shipment.carrierId === viewerId) return "carrier";
  if (shipment.driverId === viewerId) return "driver";
  if (shipment.shipperId === viewerId) return "shipper";
  return null;
}

function toDetailView(
  shipment: ShipmentWithEvents,
  viewerId: string,
  t: ReturnType<typeof useTranslations>,
  stop: ReturnType<typeof useTranslations>
): DeliveryDetailView {
  const role = roleFor(shipment, viewerId);

  return {
    id: shipment.id,
    listingId: shipment.listingId,
    title: shipment.listing?.title ?? t("card.defaultTitle"),
    status: shipment.status,
    role,
    priceCents: shipment.priceCents,
    pickupAddress: shipment.pickupAddress,
    dropoffAddress: shipment.dropoffAddress,
    scheduledPickup: shipment.scheduledPickup,
    scheduledDelivery: shipment.scheduledDelivery,
    deliveredAt: shipment.deliveredAt,
    cancellationReason: shipment.cancellationReason,
    cancelledBySide: shipment.cancelledBySide ?? null,
    cancellationCategory: shipment.cancellationCategory ?? null,
    carrier: shipment.carrier,
    driver: shipment.driver,
    shipper: shipment.shipper,
    // Staff are not a party, so "the other side" is the transporter — the one
    // an operator actually needs to reach.
    counterpart:
      role === "carrier" || role === "driver"
        ? shipment.shipper
        : shipment.carrier,
    timeline: toTimeline(shipment, t, stop),
    // Asked of the same module the service asks, rather than guessed here.
    // A transporter reaching this screen — a self-assigned carrier resolves to
    // `carrier`, and the driver dashboard links straight to it — gets nothing:
    // their verb is withdraw, and it lives on the driver surface.
    canCancel:
      role === "shipper" && canCancelAs("requester", shipment.status),
  };
}

/**
 * The timeline is the recorded event history, oldest first. A shipment created
 * before event recording existed still gets its creation step synthesised so
 * the section is never blank.
 */
function toTimeline(
  shipment: ShipmentWithEvents,
  t: ReturnType<typeof useTranslations>,
  stop: ReturnType<typeof useTranslations>
): TimelineStep[] {
  const events: ShipmentEvent[] = [...shipment.events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (events.length === 0) {
    events.push({
      id: shipment.id,
      status: shipment.status,
      previousStatus: null,
      actorRole: "system",
      note: null,
      createdAt: shipment.createdAt,
    });
  }

  const terminal = ["DELIVERED", "CANCELLED"].includes(shipment.status);

  return events.map((event, index) => ({
    status: event.status,
    // The cancellation step says which side ended the run. Read off the
    // shipment rather than the event's metadata: the row is the record, and it
    // is written in the same UPDATE as the status it describes.
    label:
      event.status === "CANCELLED" && shipment.cancelledBySide
        ? stop(`by.${shipment.cancelledBySide}`)
        : t(`events.${event.status}`),
    date: format(new Date(event.createdAt), "d MMM yyyy HH:mm"),
    note: event.note,
    step:
      index < events.length - 1 || terminal
        ? ("completed" as const)
        : ("active" as const),
    confirmation: confirmationFor(shipment, event.status),
  }));
}

/**
 * The client's answer on a step, or the fact that we are still waiting for it.
 *
 * A step the client is never asked about returns null rather than "awaiting",
 * so the timeline does not show a pending signature nobody will ever give.
 */
function confirmationFor(
  shipment: ShipmentWithEvents,
  status: ShipmentStatus
): TimelineConfirmation | null {
  if (!(ATTESTABLE as readonly string[]).includes(status)) return null;

  const match = (shipment.confirmations ?? []).find(
    (c) => c.milestone === status
  );
  if (!match) {
    return { state: "awaiting", channel: null, role: "client", date: null };
  }

  return {
    state: "confirmed",
    channel: match.channel,
    role: match.confirmedByRole ?? "client",
    date: format(new Date(match.createdAt), "d MMM yyyy HH:mm"),
  };
}
