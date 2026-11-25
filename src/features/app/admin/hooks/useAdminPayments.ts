import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { ApiError } from "@/lib/fetcher";

// ========================================
// Types
// ========================================

interface AdminPayment {
    id: string;
    amount: number;
    currency: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
    stripePaymentIntentId: string | null;
    listingId: string | null;
    createdAt: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
}

interface PaymentsApiResponse {
    success: boolean;
    data?: {
        items: AdminPayment[];
        total: number;
    };
    error?: {
        code: string;
        message: string;
    };
}

interface RefundApiResponse {
    success: boolean;
    data?: { refund: unknown };
    error?: {
        code: string;
        message: string;
    };
}

// ========================================
// Fetch Functions
// ========================================

async function fetchAdminPayments(): Promise<AdminPayment[]> {
    const response = await fetch("/api/admin/payments");
    const json: PaymentsApiResponse = await response.json();

    if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to fetch payments");
    }

    return json.data?.items || [];
}

async function processRefundApi(
    paymentId: string,
    reason?: string
): Promise<void> {
    const response = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, reason }),
    });
    const json: RefundApiResponse = await response.json();

    if (!response.ok || !json.success) {
        // The code travels; the server's sentence is never shown.
        throw new ApiError(
            json.error?.code ?? "REFUND_FAILED",
            json.error?.message ?? "",
            response.status
        );
    }
}

// ========================================
// Hook
// ========================================

export function useAdminPayments() {
    const queryClient = useQueryClient();
    const t = useTranslations("admin.payments.toasts");

    const query = useQuery({
        queryKey: ["admin", "payments"],
        queryFn: fetchAdminPayments,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });

    const refundMutation = useMutation({
        mutationFn: ({
            paymentId,
            reason,
        }: {
            paymentId: string;
            reason?: string;
        }) => processRefundApi(paymentId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
            toast.success(t("refunded"));
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError && error.code === "REFUND_NOT_LOCAL"
                    ? t("refundNotLocal")
                    : t("refundFailed")
            );
        },
    });

    return {
        ...query,
        processRefund: refundMutation.mutate,
        isRefunding: refundMutation.isPending,
    };
}

export type { AdminPayment };
