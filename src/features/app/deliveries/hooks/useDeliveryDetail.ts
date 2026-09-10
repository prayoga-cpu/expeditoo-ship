"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/fetcher";
import { useAuth } from "@/lib/auth-context";
import {
  deliveriesApi,
  type ConfirmableMilestone,
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

/**
 * Which run states put a milestone in the past, mirroring the service's own
 * table (transport_status_confirmation_spec.md §4). The service is the
 * authority and answers `MILESTONE_NOT_REACHED` either way; this copy exists
 * so the screen never offers a button that would 409.
 *
 * `PICKED_UP` stays attestable once the run has moved on: the client is asked
 * at the moment of pickup and may well answer a day later.
 */
const REACHED_IN: Record<ConfirmableMilestone, ShipmentStatus[]> = {
  PICKED_UP: ["PICKED_UP", "IN_TRANSIT", "DELIVERED"],
  DELIVERED: ["DELIVERED"],
};

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

/**
 * Where one attestable milestone stands for the person looking at it.
 *
 * Only milestones the run has actually reached are listed, so the screen has
 * nothing to say about a delivery that has not happened.
 */
export interface MilestoneAttestation {
  milestone: ConfirmableMilestone;
  /** Answered already — the screen shows the answer, never a second button. */
  confirmed: boolean;
  /** Who answered. Null while nobody has. */
  role: "client" | "operator" | null;
  date: string | null;
}

/**
 * The client's own confirmation, from the delivery screen rather than from the
 * SMS or the email they have to go and find.
 *
 * Reads the shipment through the detail query's own key, so it shares the
 * cache the page has already filled instead of fetching a second copy, and
 * invalidates it on success so the timeline's confirmation line updates with
 * the card.
 *
 * A confirmed milestone offers no button at all: the unique index makes a
 * replay a no-op, and a control that errors on a second press is worse than
 * one that is not there.
 */
export function useShipmentAttestations(shipmentId: string) {
  const t = useTranslations("deliveries.confirmation");
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: deliveryKeys.detail(shipmentId),
    queryFn: () => deliveriesApi.getById(shipmentId),
    enabled: Boolean(shipmentId),
  });

  const mutation = useMutation({
    mutationFn: (milestone: ConfirmableMilestone) =>
      deliveriesApi.confirm(shipmentId, { milestone }),
    onSuccess: (result) => {
      // A second tap is the same answer, not a failure: the client may already
      // have confirmed from the link we texted them.
      toast.success(result.alreadyConfirmed ? t("alreadyDone") : t("thanks"));
      queryClient.invalidateQueries({
        queryKey: deliveryKeys.detail(shipmentId),
      });
    },
    onError: (error) => toast.error(attestationError(error, t)),
  });

  return {
    milestones: data ? attestationsFor(data) : [],
    confirm: mutation.mutate,
    /** The milestone currently being sent, so only its own button waits. */
    pendingMilestone: mutation.isPending ? (mutation.variables ?? null) : null,
  };
}

function attestationsFor(shipment: ShipmentWithEvents): MilestoneAttestation[] {
  // Nothing to sign for on a run that was called off. The service refuses it
  // too, with `SHIPMENT_CANCELLED`.
  if (shipment.status === "CANCELLED") return [];

  return ATTESTABLE.filter((milestone) =>
    REACHED_IN[milestone].includes(shipment.status)
  ).map((milestone) => {
    const match = (shipment.confirmations ?? []).find(
      (confirmation) => confirmation.milestone === milestone
    );

    return {
      milestone,
      confirmed: Boolean(match),
      role: match?.confirmedByRole ?? null,
      date: match ? format(new Date(match.createdAt), "d MMM yyyy HH:mm") : null,
    };
  });
}

/**
 * The server's codes, said in the reader's language. Its own messages are
 * English server strings, and this is a client-facing surface in a French
 * market.
 */
function attestationError(
  error: unknown,
  t: ReturnType<typeof useTranslations>
): string {
  const code = error instanceof ApiError ? error.code : "";

  switch (code) {
    case "MILESTONE_NOT_REACHED":
      return t("notReached");
    case "SHIPMENT_CANCELLED":
      return t("cancelledTransport");
    case "TRANSPORTER_CANNOT_ATTEST":
    case "FORBIDDEN":
      return t("notYours");
    default:
      return t("failed");
  }
}
