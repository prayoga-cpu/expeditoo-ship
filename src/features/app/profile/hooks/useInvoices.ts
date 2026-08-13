import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ========================================
// Types
// ========================================

export interface Invoice {
    id: string;
    invoiceNumber: string;
    paymentId: string;
    userId: string;
    amount: number;
    currency: string;
    status: "draft" | "issued" | "paid" | "void";
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
    pdfUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface InvoicesResponse {
    items: Invoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface InvoiceQueryParams {
    page?: number;
    limit?: number;
    status?: "draft" | "issued" | "paid" | "void";
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

async function fetchInvoices(params: InvoiceQueryParams = {}): Promise<InvoicesResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.status) searchParams.set("status", params.status);

    const response = await fetch(`/api/user/invoices?${searchParams.toString()}`);
    const json: ApiResponse<InvoicesResponse> = await response.json();

    if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to fetch invoices");
    }

    return json.data;
}

async function fetchInvoiceById(id: string): Promise<{ invoice: Invoice }> {
    const response = await fetch(`/api/user/invoices/${id}`);
    const json: ApiResponse<{ invoice: Invoice }> = await response.json();

    if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to fetch invoice");
    }

    return json.data;
}

// ========================================
// Hooks
// ========================================

/**
 * Hook to fetch user invoices with pagination
 */
export function useInvoices(params: InvoiceQueryParams = {}) {
    return useQuery({
        queryKey: ["invoices", params],
        queryFn: () => fetchInvoices(params),
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Hook to fetch a single invoice by ID
 */
export function useInvoice(id: string | null) {
    return useQuery({
        queryKey: ["invoice", id],
        queryFn: () => fetchInvoiceById(id!),
        enabled: !!id,
        staleTime: 60 * 1000,
    });
}

/**
 * Get PDF download URL for an invoice
 */
export function getInvoicePdfUrl(invoiceId: string): string {
    return `/api/user/invoices/${invoiceId}/pdf`;
}
