"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  carrierApi,
  type CarrierApplication,
  type CarrierProfileInput,
  type VehicleInput,
} from "../api/carrier.api";
import { ApiError } from "@/lib/fetcher";

const carrierKeys = {
  application: ["carrier", "application"] as const,
  vehicles: ["carrier", "vehicles"] as const,
};

type Translate = (key: string) => string;

/**
 * Picks the message for a failed mutation: a translated one when the server
 * sent a code we have wording for, otherwise the server's own sentence, and a
 * translated fallback when there is nothing useful to show.
 */
function describe(
  error: unknown,
  t: Translate,
  fallbackKey: string,
  codeKeys: Record<string, string> = {}
): string {
  const code = error instanceof ApiError ? error.code : "";
  const key = codeKeys[code];
  if (key) return t(key);
  if (error instanceof Error && error.message) return error.message;
  return t(fallbackKey);
}

/**
 * A user with no carrier row yet is a normal state, not an error: the REST
 * layer answers with no payload, which React Query would reject as `undefined`,
 * so it is normalised to `null` and the screen renders the apply view.
 */
export function useCarrierApplication() {
  return useQuery<CarrierApplication | null>({
    queryKey: carrierKeys.application,
    queryFn: async () => (await carrierApi.getApplication()) ?? null,
    retry: false,
  });
}

export function useSaveCarrierProfile() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: (input: CarrierProfileInput) => carrierApi.saveProfile(input),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      toast.error(
        describe(error, t, "saveFailed", {
          SIRET_ALREADY_REGISTERED: "siretTaken",
        })
      );
    },
  });
}

/**
 * Submission is the one call that can fail with a list rather than a message:
 * the server returns every gap at once so the applicant sees the whole set.
 */
export function useSubmitApplication() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: () => carrierApi.submit(),
    onSuccess: () => {
      toast.success(t("submitted"));
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "INCOMPLETE_APPLICATION") {
        toast.error(t("incomplete"), {
          description: t("incompleteDescription"),
        });
        return;
      }
      toast.error(describe(error, t, "submitFailed"));
    },
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: () => carrierApi.withdraw(),
    onSuccess: () => {
      toast.success(t("withdrawn"));
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      toast.error(describe(error, t, "withdrawFailed"));
    },
  });
}

export function useSetBanking() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: ({ iban, bic }: { iban: string; bic: string }) =>
      carrierApi.setBanking(iban, bic),
    onSuccess: () => {
      toast.success(t("bankingSaved"));
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      toast.error(
        describe(error, t, "bankingFailed", {
          VALIDATION_ERROR: "bankingInvalid",
        })
      );
    },
  });
}

/** Documents are private: viewing means fetching a short-lived signed URL. */
export function useViewDocument() {
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: (id: string) => carrierApi.viewDocument(id),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (error) => {
      toast.error(describe(error, t, "documentOpenFailed"));
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: ({
      kind,
      file,
      expiresAt,
    }: {
      kind: string;
      file: File;
      expiresAt?: string;
    }) => carrierApi.uploadDocument(kind, file, expiresAt),
    onSuccess: () => {
      toast.success(t("documentUploaded"));
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      toast.error(
        describe(error, t, "uploadFailed", {
          UNSUPPORTED_DOCUMENT_TYPE: "documentTypeUnsupported",
          DOCUMENT_TOO_LARGE: "documentTooLarge",
          DOCUMENT_ALREADY_EXPIRED: "documentAlreadyExpired",
        })
      );
    },
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: carrierKeys.vehicles,
    queryFn: () => carrierApi.listVehicles(),
  });
}

export function useAddVehicle() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: (input: VehicleInput) => carrierApi.addVehicle(input),
    onSuccess: () => {
      toast.success(t("vehicleAdded"));
      queryClient.invalidateQueries({ queryKey: carrierKeys.vehicles });
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      toast.error(
        describe(error, t, "vehicleAddFailed", {
          VALIDATION_ERROR: "vehicleInvalid",
        })
      );
    },
  });
}

export function useToggleVehicleActive() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      carrierApi.updateVehicle(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: carrierKeys.vehicles });
    },
    onError: (error) => {
      toast.error(describe(error, t, "vehicleUpdateFailed"));
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  const t = useTranslations("carrier.toasts");

  return useMutation({
    mutationFn: (id: string) => carrierApi.deleteVehicle(id),
    onSuccess: () => {
      toast.success(t("vehicleRemoved"));
      queryClient.invalidateQueries({ queryKey: carrierKeys.vehicles });
    },
    onError: (error) => {
      // A vehicle backing a live offer cannot be deleted; the DB blocks it.
      toast.error(
        describe(error, t, "vehicleRemoveFailed", {
          VEHICLE_IN_USE: "vehicleInUse",
        })
      );
    },
  });
}
