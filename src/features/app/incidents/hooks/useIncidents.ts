"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/fetcher";
import {
  incidentsApi,
  type IncidentQueueParams,
  type ReportIncidentBody,
} from "../api/incidents.api";

/**
 * Every surface here exposes `isError` rather than collapsing failure to an
 * empty list: a query hook that returns null on failure renders a blank page,
 * which is exactly how the withdrawals 500 stayed invisible (CLAUDE.md
 * §Gotchas 9).
 */
export function useShipmentIncidents(shipmentId: string, enabled = true) {
  const query = useQuery({
    queryKey: ["incidents", shipmentId],
    queryFn: () => incidentsApi.listForShipment(shipmentId),
    enabled: enabled && Boolean(shipmentId),
  });

  return {
    incidents: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useReportIncident(shipmentId: string) {
  const t = useTranslations("incidents.feedback");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ReportIncidentBody) =>
      incidentsApi.report(shipmentId, body),
    onSuccess: () => {
      toast.success(t("reported"));
      queryClient.invalidateQueries({ queryKey: ["incidents", shipmentId] });
      // The report also lands on the timeline both parties read.
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["driver-shipments"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        code === "INCIDENT_RUN_CLOSED"
          ? t("runClosed")
          : error instanceof Error
            ? error.message
            : t("failed")
      );
    },
  });
}

export function useIncidentQueue(params: IncidentQueueParams) {
  const query = useQuery({
    queryKey: ["incident-queue", params],
    queryFn: () => incidentsApi.queue(params),
  });

  return {
    page: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useUpdateIncident() {
  const t = useTranslations("incidents.feedback");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      incidentId,
      status,
      resolutionNote,
    }: {
      incidentId: string;
      status: "ACKNOWLEDGED" | "RESOLVED";
      resolutionNote?: string;
    }) => incidentsApi.update(incidentId, { status, resolutionNote }),
    onSuccess: () => {
      toast.success(t("updated"));
      queryClient.invalidateQueries({ queryKey: ["incident-queue"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("failed")),
  });
}
