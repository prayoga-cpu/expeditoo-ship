import { useQuery } from "@tanstack/react-query";

// ========================================
// Types
// ========================================

export interface Payment {
    id: string;
    userId: string;
    listingId: string | null;
    shipmentId: string | null;
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
    amount: number;
    currency: string;
    status: "pending" | "processing" | "succeeded" | "failed" | "refunded";
    paymentMethod: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    invoice: {
        id: string;
        invoiceNumber: string;
        pdfUrl: string | null;
    } | null;
}

export interface PaymentsResponse {
    items: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaymentQueryParams {
    page?: number;
    limit?: number;
    status?: "pending" | "processing" | "succeeded" | "failed" | "refunded";
}

// Standard API response wrapper
interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: {
        code: string;
        message: string;
    };
}

// ========================================
// API Functions
// ========================================

async function fetchPayments(params: PaymentQueryParams = {}): Promise<PaymentsResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.status) searchParams.set("status", params.status);

    const response = await fetch(`/api/user/payments?${searchParams.toString()}`);
    const json: ApiResponse<PaymentsResponse> = await response.json();

    if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to fetch payments");
    }

    return json.data;
}

// ========================================
// Hooks
// ========================================

/**
 * Hook to fetch user payment history with pagination
 */
export function usePayments(params: PaymentQueryParams = {}) {
    return useQuery({
        queryKey: ["payments", params],
        queryFn: () => fetchPayments(params),
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Hook to get payment statistics for the current user
 */
export function usePaymentStats() {
    const { data, ...rest } = usePayments({ limit: 100 });

    const stats = data ? {
        totalSpent: data.items
            .filter(p => p.status === "succeeded")
            .reduce((sum, p) => sum + p.amount, 0) / 100,
        successfulPayments: data.items.filter(p => p.status === "succeeded").length,
        pendingPayments: data.items.filter(p => p.status === "pending" || p.status === "processing").length,
        refundedPayments: data.items.filter(p => p.status === "refunded").length,
    } : null;

    return { stats, ...rest };
}
