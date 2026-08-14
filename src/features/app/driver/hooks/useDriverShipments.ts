"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/fetcher";
import { useAuth } from "@/lib/auth-context";
import {
  driverShipmentsApi,
  type DriverShipmentStatus,
} from "../api/shipments.api";

/** One page is plenty: a driver's live workload is a handful of runs. */
const LIST_LIMIT = 50;

/**
 * Every shipment the driver is a party to. The API scopes the list to the
 * caller, so no role parameter is needed (or accepted).
 */
export function useDriverShipments() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["driver-shipments"],
    queryFn: () => driverShipmentsApi.list({ limit: LIST_LIMIT }),
  });

  return {
    shipments: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError,
    error: error as Error | null,
  };
}

export function useDriverShipmentDetail(id: string) {
  const {
    data: shipment,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["driver-shipment", id],
    queryFn: () => driverShipmentsApi.get(id),
    enabled: !!id,
  });

  return { shipment, isLoading, isError, error: error as Error | null };
}

/** Maps the service's error codes to something a driver can act on. */
function useActionErrorMessage() {
  const t = useTranslations("driver.actions.errors");

  return (error: unknown) => {
    const code = error instanceof ApiError ? error.code : "";
    switch (code) {
      case "INVALID_STATUS_TRANSITION":
        return t("staleStatus");
      case "FORBIDDEN":
        return t("forbidden");
      case "SHIPMENT_NOT_FOUND":
        return t("notFound");
      case "CANNOT_UPLOAD_POD":
        return t("podNotInTransit");
      case "DRIVER_NOT_IN_FLEET":
        return t("notInFleet");
      default:
        return error instanceof Error ? error.message : t("generic");
    }
  };
}

function invalidateShipment(queryClient: QueryClient, shipmentId: string) {
  queryClient.invalidateQueries({ queryKey: ["driver-shipment", shipmentId] });
  queryClient.invalidateQueries({ queryKey: ["driver-shipments"] });
}

/**
 * Claim a PENDING run for oneself, the PENDING → ASSIGNED step that otherwise
 * has no caller. Most carriers in this market drive their own jobs, so the
 * driver nominated is always the viewer; the service still checks that they
 * belong to the winning carrier's fleet.
 */
export function useAssignSelfToShipment(shipmentId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("driver.actions");
  const messageFor = useActionErrorMessage();
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  const mutation = useMutation({
    mutationFn: () => {
      if (!viewerId) {
        throw new ApiError("NO_SESSION", "Not signed in", 401);
      }
      return driverShipmentsApi.assign(shipmentId, viewerId);
    },
    onSuccess: () => {
      toast.success(t("jobStarted"));
      invalidateShipment(queryClient, shipmentId);
    },
    onError: (error) => toast.error(messageFor(error)),
  });

  return { ...mutation, canAssign: viewerId !== null };
}

/** Advance the run along the legal path enforced by the shipment service. */
export function useUpdateShipmentStatus(shipmentId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("driver.actions");
  const messageFor = useActionErrorMessage();

  return useMutation({
    mutationFn: (input: { status: DriverShipmentStatus; note?: string }) =>
      driverShipmentsApi.updateStatus(shipmentId, input.status, input.note),
    onSuccess: () => {
      toast.success(t("statusUpdated"));
      invalidateShipment(queryClient, shipmentId);
    },
    onError: (error) => toast.error(messageFor(error)),
  });
}

/**
 * Proof of delivery in two legs: the photo goes to storage first, then its URL
 * is attached to the shipment, which also closes the run as DELIVERED.
 */
export function useUploadProofOfDelivery(shipmentId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("driver.actions");
  const messageFor = useActionErrorMessage();

  return useMutation({
    mutationFn: async (file: File) => {
      const { url } = await driverShipmentsApi.uploadPodPhoto(file);
      return driverShipmentsApi.submitProofOfDelivery(shipmentId, url);
    },
    onSuccess: () => {
      toast.success(t("proofUploaded"));
      invalidateShipment(queryClient, shipmentId);
    },
    onError: (error) => toast.error(messageFor(error)),
  });
}
