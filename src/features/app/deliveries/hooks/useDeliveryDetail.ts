"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import {
  deliveriesApi,
  type ShipmentEvent,
  type ShipmentWithEvents,
} from "../api/deliveries.api";
import type {
  DeliveryDetailView,
  DeliveryRole,
  TimelineStep,
} from "../types";
import { deliveryKeys } from "./useDeliveries";

/** A shipper or carrier may self-cancel until the goods are on a vehicle. */
const CANCELLABLE = ["PENDING", "ASSIGNED"] as const;

export function useDeliveryDetail(id: string) {
  const t = useTranslations("deliveries");
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: deliveryKeys.detail(id),
    queryFn: () => deliveriesApi.getById(id),
    enabled: Boolean(id),
  });

  const delivery: DeliveryDetailView | null =
    data && user ? toDetailView(data, user.id, t) : null;

  return {
    delivery,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : null,
  };
}

function roleFor(shipment: ShipmentWithEvents, viewerId: string): DeliveryRole {
  if (shipment.carrierId === viewerId) return "carrier";
  if (shipment.driverId === viewerId) return "driver";
  return "shipper";
}

function toDetailView(
  shipment: ShipmentWithEvents,
  viewerId: string,
  t: ReturnType<typeof useTranslations>
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
    proofOfDeliveryUrl: shipment.proofOfDeliveryUrl,
    carrier: shipment.carrier,
    driver: shipment.driver,
    shipper: shipment.shipper,
    counterpart: role === "shipper" ? shipment.carrier : shipment.shipper,
    timeline: toTimeline(shipment, t),
    canCancel:
      role !== "driver" &&
      (CANCELLABLE as readonly string[]).includes(shipment.status),
  };
}

/**
 * The timeline is the recorded event history, oldest first. A shipment created
 * before event recording existed still gets its creation step synthesised so
 * the section is never blank.
 */
function toTimeline(
  shipment: ShipmentWithEvents,
  t: ReturnType<typeof useTranslations>
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
    label: t(`events.${event.status}`),
    date: format(new Date(event.createdAt), "d MMM yyyy HH:mm"),
    note: event.note,
    step:
      index < events.length - 1 || terminal
        ? ("completed" as const)
        : ("active" as const),
  }));
}
