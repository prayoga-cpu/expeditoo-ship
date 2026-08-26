"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import { deliveriesApi, type Shipment } from "@/features/app/deliveries/api";
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
};

/** Statuses that count as "carried out" — the run is over, either way. */
const COMPLETED_STATUSES = "DELIVERED,CANCELLED";

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
  };
}
