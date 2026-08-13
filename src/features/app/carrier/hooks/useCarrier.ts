"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { carrierApi, type CarrierProfileInput, type VehicleInput } from "../api/carrier.api";
import { ApiError } from "@/lib/fetcher";

const carrierKeys = {
  application: ["carrier", "application"] as const,
  vehicles: ["carrier", "vehicles"] as const,
};

export function useCarrierApplication() {
  return useQuery({
    queryKey: carrierKeys.application,
    queryFn: () => carrierApi.getApplication(),
    retry: false,
  });
}

export function useSaveCarrierProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CarrierProfileInput) => carrierApi.saveProfile(input),
    onSuccess: () => {
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        code === "SIRET_ALREADY_REGISTERED"
          ? "That SIRET already belongs to another carrier account"
          : error instanceof Error
            ? error.message
            : "Could not save"
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

  return useMutation({
    mutationFn: () => carrierApi.submit(),
    onSuccess: () => {
      toast.success("Application submitted for review");
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "INCOMPLETE_APPLICATION") {
        toast.error("Your application is incomplete", {
          description: "Check the highlighted items below.",
        });
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not submit");
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

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
      toast.success("Document uploaded");
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      const message =
        code === "UNSUPPORTED_DOCUMENT_TYPE"
          ? "Only PDF, JPEG and PNG are accepted"
          : code === "DOCUMENT_TOO_LARGE"
            ? "That file is over 10 MB"
            : code === "DOCUMENT_ALREADY_EXPIRED"
              ? "That document has already expired"
              : error instanceof Error
                ? error.message
                : "Upload failed";
      toast.error(message);
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

  return useMutation({
    mutationFn: (input: VehicleInput) => carrierApi.addVehicle(input),
    onSuccess: () => {
      toast.success("Vehicle added");
      queryClient.invalidateQueries({ queryKey: carrierKeys.vehicles });
      queryClient.invalidateQueries({ queryKey: carrierKeys.application });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        code === "VALIDATION_ERROR"
          ? "Check the plate format (AB-123-CD) and weight"
          : error instanceof Error
            ? error.message
            : "Could not add vehicle"
      );
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => carrierApi.deleteVehicle(id),
    onSuccess: () => {
      toast.success("Vehicle removed");
      queryClient.invalidateQueries({ queryKey: carrierKeys.vehicles });
    },
    onError: (error) => {
      // A vehicle backing a live offer cannot be deleted; the DB blocks it.
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        code === "VEHICLE_IN_USE"
          ? "This vehicle backs a live offer. Deactivate it instead."
          : error instanceof Error
            ? error.message
            : "Could not remove vehicle"
      );
    },
  });
}
