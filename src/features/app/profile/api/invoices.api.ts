import { api, toQuery } from "@/lib/fetcher";

export type InvoiceStatus = "draft" | "issued" | "paid" | "void";
export type InvoiceKind = "invoice" | "credit_note";

export interface Invoice {
    id: string;
    invoiceNumber: string;
    paymentId: string;
    userId: string;
    amount: number;
    currency: string;
    status: InvoiceStatus;
    kind: InvoiceKind;
    relatedInvoiceId: string | null;
    relatedInvoiceNumber: string | null;
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
    status?: InvoiceStatus;
    /** ISO bounds for the Cocolis period filter. */
    from?: string;
    to?: string;
}

export const invoicesApi = {
    list: (params: InvoiceQueryParams = {}) =>
        api.get<InvoicesResponse>(`/api/user/invoices${toQuery(params)}`),

    byId: (id: string) =>
        api.get<{ invoice: Invoice }>(`/api/user/invoices/${id}`),

    /**
     * No recipient: the document goes to the account it belongs to and nowhere
     * else. The answer masks the address it reached.
     */
    email: (id: string) =>
        api.post<{ sentTo: string }>(`/api/user/invoices/${id}/email`),
};

/** One document as a PDF. A plain link, so the browser handles the download. */
export function getInvoicePdfUrl(invoiceId: string): string {
    return `/api/user/invoices/${invoiceId}/pdf`;
}

/** Every document in a period, as one PDF — the bulk download button. */
export function getInvoiceStatementUrl(period: { from?: string; to?: string }): string {
    return `/api/user/invoices/statement${toQuery(period)}`;
}
