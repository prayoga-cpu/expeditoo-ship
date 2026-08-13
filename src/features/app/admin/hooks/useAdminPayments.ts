import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
        throw new Error(json.error?.message || "Failed to process refund");
    }
}

// ========================================
// Hook
// ========================================

export function useAdminPayments() {
    const queryClient = useQueryClient();

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
            toast.success("Refund processed successfully");
        },
        onError: (error) => {
            toast.error(`Refund failed: ${error.message}`);
        },
    });

    return {
        ...query,
        processRefund: refundMutation.mutate,
        isRefunding: refundMutation.isPending,
    };
}

export type { AdminPayment };
