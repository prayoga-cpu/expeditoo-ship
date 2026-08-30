"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/fetcher";
import {
  shipmentPhotosApi,
  type ShipmentPhotoStage,
} from "../api/shipment-photos.api";
import { useGeolocation, type GeolocationFailure } from "./useGeolocation";

/** Every party to the run reads the same list, so one hook serves both sides. */
export function useShipmentPhotos(shipmentId: string) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["shipment-photos", shipmentId],
    queryFn: () => shipmentPhotosApi.list(shipmentId),
    enabled: !!shipmentId,
  });

  return {
    pickup: data?.pickup ?? [],
    delivery: data?.delivery ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  };
}

/**
 * Take one photo: get a fresh fix, then send it with the bytes.
 *
 * The fix comes first and a failure stops the upload, rather than sending the
 * photo and attaching a location later. There is no "continue without
 * location" branch anywhere in this flow.
 */
export function useCaptureShipmentPhoto(
  shipmentId: string,
  stage: ShipmentPhotoStage
) {
  const queryClient = useQueryClient();
  const t = useTranslations("shipmentPhotos");
  const { locate, isLocating, isSupported } = useGeolocation();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const location = await locate();
      return shipmentPhotosApi.capture(shipmentId, stage, file, location);
    },
    onSuccess: () => {
      toast.success(t("added"));
      queryClient.invalidateQueries({
        queryKey: ["shipment-photos", shipmentId],
      });
      // The gate reads this list, so the advance button has to re-render.
      queryClient.invalidateQueries({ queryKey: ["driver-shipment", shipmentId] });
      queryClient.invalidateQueries({ queryKey: ["driver-shipments"] });
    },
    onError: (error) => toast.error(messageFor(error, t)),
  });

  return { ...mutation, isLocating, isSupported };
}

/**
 * Location failures get their own messages because the remedy differs: one is
 * a browser permission the driver can grant, the other is a sky they need to
 * see more of. "Something went wrong" would leave them tapping the same button.
 */
function messageFor(
  error: unknown,
  t: ReturnType<typeof useTranslations>
): string {
  const failure = error as GeolocationFailure;
  if (failure === "denied") return t("errors.locationDenied");
  if (failure === "timeout" || failure === "unavailable") {
    return t("errors.locationUnavailable");
  }
  if (failure === "unsupported") return t("errors.locationUnsupported");

  const code = error instanceof ApiError ? error.code : "";
  switch (code) {
    case "LOCATION_REQUIRED":
      return t("errors.locationUnavailable");
    case "PHOTO_STAGE_NOT_OPEN":
      return t("errors.stageClosed");
    case "PHOTO_LIMIT_REACHED":
      return t("errors.limitReached");
    case "FILE_TOO_LARGE":
      return t("errors.tooLarge");
    case "INVALID_FILE_TYPE":
      return t("errors.invalidType");
    default:
      return error instanceof Error ? error.message : t("errors.generic");
  }
}
