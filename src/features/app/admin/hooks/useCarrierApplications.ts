import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
    fetchCarrierApplications,
    approveCarrierApplication,
    rejectCarrierApplication,
    suspendCarrier,
    setCarrierAvailability,
    deregisterCarrier,
    reinstateCarrier,
    fetchDocumentViewUrl,
    type CarrierApplicationFilter,
    type CarrierAvailabilityRequest,
} from "../api/carriers.api";

export function useCarrierApplications(status: CarrierApplicationFilter) {
    const queryClient = useQueryClient();
    const t = useTranslations("admin.carriers.toasts");

    const {
        data: applications = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ["carrier-applications", status],
        queryFn: () => fetchCarrierApplications(status),
    });

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["carrier-applications"] });

    const approveMutation = useMutation({
        mutationFn: (id: string) => approveCarrierApplication(id),
        onSuccess: () => {
            invalidate();
            toast.success(t("approved"));
        },
        onError: (error) => {
            toast.error(t("approveFailed", { message: error.message }));
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            rejectCarrierApplication(id, reason),
        onSuccess: () => {
            invalidate();
            toast.success(t("rejected"));
        },
        onError: (error) => {
            toast.error(t("rejectFailed", { message: error.message }));
        },
    });

    const suspendMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            suspendCarrier(id, reason),
        onSuccess: () => {
            invalidate();
            toast.success(t("suspended"));
        },
        onError: (error) => {
            toast.error(t("suspendFailed", { message: error.message }));
        },
    });

    // Actif / Absent / Désinscrit (client_feedback_2026_10_29_spec.md §REQ-02).
    const availabilityMutation = useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            id: string;
            input: CarrierAvailabilityRequest;
        }) => setCarrierAvailability(id, input),
        onSuccess: (_data, { input }) => {
            invalidate();
            toast.success(t(input.absent ? "markedAbsent" : "absenceEnded"));
        },
        onError: (error) => {
            toast.error(t("actionFailed", { message: error.message }));
        },
    });

    const deregisterMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            deregisterCarrier(id, reason),
        onSuccess: () => {
            invalidate();
            toast.success(t("deregistered"));
        },
        onError: (error) => {
            toast.error(
                error.message === "CARRIER_HAS_LIVE_RUNS"
                    ? t("hasLiveRuns")
                    : t("actionFailed", { message: error.message }),
            );
        },
    });

    const reinstateMutation = useMutation({
        mutationFn: (id: string) => reinstateCarrier(id),
        onSuccess: () => {
            invalidate();
            toast.success(t("reinstated"));
        },
        onError: (error) => {
            toast.error(t("actionFailed", { message: error.message }));
        },
    });

    return {
        applications,
        isLoading,
        error,
        approveApplication: approveMutation.mutateAsync,
        rejectApplication: rejectMutation.mutateAsync,
        suspendCarrierAccount: suspendMutation.mutateAsync,
        setAvailability: availabilityMutation.mutateAsync,
        deregisterCarrierAccount: deregisterMutation.mutateAsync,
        reinstateCarrierAccount: reinstateMutation.mutateAsync,
        isUpdating:
            approveMutation.isPending ||
            rejectMutation.isPending ||
            suspendMutation.isPending ||
            availabilityMutation.isPending ||
            deregisterMutation.isPending ||
            reinstateMutation.isPending,
    };
}

/**
 * KYC documents are never linkable directly: this exchanges a document id for
 * a short-lived presigned URL and opens it in a new tab.
 */
export function useCarrierDocumentViewer() {
    const t = useTranslations("admin.carriers.detail");
    const [openingDocId, setOpeningDocId] = useState<string | null>(null);

    const openDocument = useCallback(
        async (documentId: string) => {
            setOpeningDocId(documentId);
            try {
                const url = await fetchDocumentViewUrl(documentId);
                window.open(url, "_blank", "noopener,noreferrer");
            } catch {
                toast.error(t("documentOpenFailed"));
            } finally {
                setOpeningDocId(null);
            }
        },
        [t],
    );

    return { openDocument, openingDocId };
}
