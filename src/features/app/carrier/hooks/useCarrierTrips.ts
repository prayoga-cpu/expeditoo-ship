"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import { useAuth } from "@/lib/auth-context";
import { deliveriesApi, type Shipment } from "@/features/app/deliveries/api";
import { offersApi } from "@/features/app/offers/api/offers.api";
import type { Job, Offer } from "@/features/app/listing/types";
import {
  tripsApi,
  type CarrierRoute,
  type CarrierRouteInput,
  type EarningsFilters,
  type EarningsItem,
} from "../api/trips.api";

export const tripKeys = {
  routes: ["carrier", "routes"] as const,
  earnings: (filters: EarningsFilters) =>
    ["carrier", "earnings", filters] as const,
  completed: ["carrier", "completed-shipments"] as const,
  /**
   * Under the offers feature's own prefix on purpose: submitting a bid, taking
   * a job and withdrawing anywhere else invalidate `["carrier-offers"]`, and
   * this list has to follow them.
   */
  pending: ["carrier-offers", "pending", "trips"] as const,
  active: ["carrier", "active-shipments"] as const,
};

/** Statuses that count as "carried out" — the run is over, either way. */
const COMPLETED_STATUSES = "DELIVERED,CANCELLED";

/** Awarded and not over: the set `useDeliveries` calls `active`. */
const ACTIVE_STATUSES = "PENDING,ASSIGNED,PICKED_UP,IN_TRANSIT";

/** The ceiling both list routes accept (`carrierOffersQuerySchema`, `/api/shipments`). */
const LIST_LIMIT = 50;

type Translate = (key: string) => string;

function describe(error: unknown, t: Translate, fallbackKey: string): string {
  const code = error instanceof ApiError ? error.code : "";
  const known: Record<string, string> = {
    ROUTE_LIMIT_REACHED: "errors.limitReached",
    CARRIER_SUSPENDED: "errors.suspended",
    CARRIER_NOT_FOUND: "errors.noCarrier",
    VEHICLE_NOT_FOUND: "errors.vehicleNotFound",
    ROUTE_NOT_FOUND: "errors.notFound",
  };

  if (known[code]) return t(known[code]);
  if (error instanceof Error && error.message) return error.message;
  return t(fallbackKey);
}

// ========================================
// Planned trips
// ========================================

export function useCarrierRoutes() {
  return useQuery({
    queryKey: tripKeys.routes,
    queryFn: () => tripsApi.listRoutes(),
    retry: false,
  });
}

export function useSaveCarrierRoute() {
  const t = useTranslations("carrier.trips");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string;
      input: CarrierRouteInput;
    }): Promise<CarrierRoute> =>
      id ? tripsApi.updateRoute(id, input) : tripsApi.createRoute(input),
    onSuccess: (_route, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.routes });
      toast.success(variables.id ? t("toast.updated") : t("toast.created"));
    },
    onError: (error) => toast.error(describe(error, t, "toast.saveFailed")),
  });
}

export function useDeleteCarrierRoute() {
  const t = useTranslations("carrier.trips");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tripsApi.deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.routes });
      toast.success(t("toast.deleted"));
    },
    onError: (error) => toast.error(describe(error, t, "toast.deleteFailed")),
  });
}

/** Pausing is the same PATCH, so it gets the switch's own feedback. */
export function useToggleCarrierRoute() {
  const t = useTranslations("carrier.trips");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      tripsApi.updateRoute(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripKeys.routes }),
    onError: (error) => toast.error(describe(error, t, "toast.saveFailed")),
  });
}

// ========================================
// Completed trips
// ========================================

export interface CompletedTrip {
  shipment: Shipment;
  earnings: EarningsItem | null;
}

/**
 * The transports actually carried out, with the money attached.
 *
 * Two sources on purpose: `/api/shipments` is the one list of runs the carrier
 * was party to, cancellations included, while `/api/carrier/earnings` is the
 * ledger and only speaks about deliveries. Joining them here keeps the money
 * authoritative without hiding a cancelled run.
 */
export function useCompletedTrips(filters: EarningsFilters = {}) {
  const shipments = useQuery({
    queryKey: tripKeys.completed,
    queryFn: () => deliveriesApi.list({ status: COMPLETED_STATUSES }),
  });

  const earnings = useQuery({
    queryKey: tripKeys.earnings(filters),
    queryFn: () => tripsApi.earnings({ ...filters, limit: 100 }),
    // A signed-in user with no carrier record is a normal state here.
    retry: false,
  });

  const trips = useMemo<CompletedTrip[]>(() => {
    const byShipment = new Map(
      (earnings.data?.items ?? []).map((item) => [item.shipmentId, item])
    );

    return (shipments.data?.items ?? []).map((shipment) => ({
      shipment,
      earnings: byShipment.get(shipment.id) ?? null,
    }));
  }, [shipments.data, earnings.data]);

  return {
    trips,
    summary: earnings.data?.summary ?? null,
    commissionRetainsAll: earnings.data?.commissionRetainsAll ?? false,
    isLoading: shipments.isLoading,
    error: shipments.error,
    // Only the run list decides failure: the ledger answering nothing is the
    // normal state of an account with no carrier record.
    isError: shipments.isError,
    refetch: shipments.refetch,
  };
}

// ========================================
// Offers awaiting an answer
// ========================================

/**
 * The job beside a pending offer. `GET /api/carrier/offers` sends it as an
 * approved carrier reads any job (`toListingView(…, "vetted")`); only what the
 * card prints is declared here.
 */
export type PendingOfferJob = Pick<
  Job,
  "id" | "reference" | "title" | "pickupCity" | "dropoffCity"
>;

export interface PendingOffer extends Offer {
  listing: PendingOfferJob | null;
}

/** The carrier's bids nobody has answered yet: not accepted, rejected or expired. */
export function usePendingOffers() {
  return useQuery({
    queryKey: tripKeys.pending,
    // `offersApi.mine` types the row without its job; the route does send it.
    queryFn: async (): Promise<PendingOffer[]> =>
      (await offersApi.mine({
        status: "pending",
        limit: LIST_LIMIT,
      })) as PendingOffer[],
    // An account without the carrier role is answered 403, which the panel
    // explains rather than retries.
    retry: false,
  });
}

const WITHDRAW_ERRORS: Record<string, string> = {
  OFFER_NOT_PENDING: "pending.toast.notPending",
};

/**
 * `useWithdrawOffer` in the offers feature speaks hardcoded English; this is
 * the same endpoint with the carrier's own words.
 */
export function useWithdrawPendingOffer() {
  const t = useTranslations("carrier.trips");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (offerId: string) => offersApi.withdraw(offerId),
    onSuccess: () => toast.success(t("pending.toast.withdrawn")),
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(t(WITHDRAW_ERRORS[code] ?? "pending.toast.withdrawFailed"));
    },
    // Stale either way: the offer left the list, or it was answered meanwhile.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ========================================
// Runs in transit
// ========================================

/** A carrier reads a run's job as the vetted view, so the cities are there. */
type ActiveTripJob = NonNullable<Shipment["listing"]> & {
  pickupCity?: string;
  dropoffCity?: string;
};

export type ActiveTrip = Omit<Shipment, "listing"> & {
  listing: ActiveTripJob | null;
};

/**
 * `/api/shipments` answers every run the caller is party to, the ones they
 * *requested* included. Without this a carrier who also posts requests would
 * find their own deliveries listed among the journeys they are driving.
 */
const carriedBy = (shipment: Shipment, userId: string) =>
  shipment.carrierId === userId || shipment.driverId === userId;

/** Runs awarded to the carrier and not finished yet. */
export function useActiveTrips() {
  const { user, isLoading: sessionLoading } = useAuth();
  const userId = user?.id ?? null;

  const shipments = useQuery({
    queryKey: tripKeys.active,
    queryFn: () =>
      deliveriesApi.list({ status: ACTIVE_STATUSES, limit: LIST_LIMIT }),
  });

  const trips = useMemo<ActiveTrip[]>(
    () =>
      userId
        ? (shipments.data?.items ?? []).filter((s) => carriedBy(s, userId))
        : [],
    [shipments.data, userId]
  );

  return {
    trips,
    isLoading: shipments.isLoading || sessionLoading,
    isError: shipments.isError,
    refetch: shipments.refetch,
  };
}
