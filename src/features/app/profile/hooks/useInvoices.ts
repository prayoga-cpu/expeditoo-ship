"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ApiError } from "@/lib/fetcher";
import {
    tripsApi,
    earningsStatementUrl,
    type EarningsFilters,
    type EarningsItem,
    type EarningsResponse,
} from "@/features/app/carrier/api/trips.api";
import {
    invoicesApi,
    getInvoicePdfUrl,
    getInvoiceStatementUrl,
    type Invoice,
    type InvoiceQueryParams,
    type InvoicesResponse,
} from "../api/invoices.api";

export type { Invoice, InvoiceQueryParams, InvoicesResponse };
export type { EarningsItem, EarningsResponse };
export { getInvoicePdfUrl, getInvoiceStatementUrl, earningsStatementUrl };

/**
 * The most rows the carrier tab asks for — the earnings route's own ceiling.
 * Past it the screen says so rather than silently dropping the oldest runs,
 * and points at a narrower period or the period's relevé.
 */
export const CARRIER_STATEMENT_LIMIT = 100;

/**
 * Hook to fetch user invoices with pagination
 */
export function useInvoices(params: InvoiceQueryParams = {}) {
    return useQuery({
        queryKey: ["invoices", params],
        queryFn: () => invoicesApi.list(params),
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * The carrier's statement lines for a period: one per delivered run, from the
 * same ledger the relevé d'activité is printed from.
 */
export function useCarrierStatement(filters: Pick<EarningsFilters, "from" | "to">) {
    return useQuery({
        queryKey: ["transactions", "carrier", filters],
        queryFn: () =>
            tripsApi.earnings({ ...filters, limit: CARRIER_STATEMENT_LIMIT }),
        staleTime: 60 * 1000,
        // The tab's own error state carries the retry.
        retry: false,
    });
}

/**
 * Hook to fetch a single invoice by ID
 */
export function useInvoice(id: string | null) {
    return useQuery({
        queryKey: ["invoice", id],
        queryFn: () => invoicesApi.byId(id!),
        enabled: !!id,
        staleTime: 60 * 1000,
    });
}

/**
 * Send a document to the address on the account.
 *
 * The error copy keys off the server's code, which is why this goes through
 * `@/lib/fetcher` rather than the hand-rolled `fetch` that used to live here:
 * that one threw `new Error(message)` and discarded the code, so every failure
 * read the same.
 */
export function useEmailInvoice() {
    const queryClient = useQueryClient();
    const t = useTranslations("profile.invoices");

    return useMutation({
        mutationFn: (id: string) => invoicesApi.email(id),
        onSuccess: (data) => {
            toast.success(t("emailSent", { address: data.sentTo }));
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
        },
        onError: (error) => {
            const code = error instanceof ApiError ? error.code : "";
            const known = ["RATE_LIMITED", "INVOICE_EMAIL_FAILED", "INVOICE_NOT_YOURS"];
            toast.error(
                known.includes(code) ? t(`errors.${code}`) : t("errors.generic")
            );
        },
    });
}
