"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Download, Mail, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import {
    useEmailInvoice,
    useInvoices,
    getInvoicePdfUrl,
    getInvoiceStatementUrl,
    type Invoice,
} from "../../hooks/useInvoices";
import { InlineLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { formatCurrency } from "@/lib/currency";
import { periodBoundsIso, type PeriodKey } from "@/lib/statement-period";
import { PeriodSelect } from "./PeriodSelect";

// Type for invoice status
type InvoiceStatus = "draft" | "issued" | "paid" | "void";

const statusStyles: Record<InvoiceStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    issued: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    void: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

/**
 * The requester's tab of the transaction history: every document raised when
 * their card was charged, and every avoir that corrected one.
 */
export function InvoiceList() {
    const t = useTranslations("profile.invoices");
    const [period, setPeriod] = useState<PeriodKey>("all");

    const bounds = useMemo(() => periodBoundsIso(period), [period]);
    const query = useInvoices(bounds);
    const invoices = query.data?.items ?? [];

    return (
        <Card>
            <CardHeader>
                <p className="text-sm text-muted-foreground">{t("description")}</p>

                {/* Says where the document actually goes, and where it does not.
                    The client asked for delivery by email and by WhatsApp; email
                    is built and automatic, WhatsApp needs a Meta-verified
                    business account and approved templates that do not exist, so
                    it sends nothing. Saying so is the difference between someone
                    waiting for a message that is never coming and someone
                    checking their inbox. Delete this line the day WhatsApp
                    works — not before. */}
                <p className="text-sm text-muted-foreground">
                    {t("deliveryNotice")}
                </p>

                {/* The controls sit above the results rather than inside them:
                    an empty period is precisely when you need to change the
                    period, so they must survive the empty state. */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <PeriodSelect value={period} onChange={setPeriod} />

                    <Button asChild variant="outline">
                        <a href={getInvoiceStatementUrl(bounds)}>
                            <Download className="h-4 w-4" />
                            {t("downloadPeriod")}
                        </a>
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                <InvoiceListBody invoices={invoices} query={query} />
            </CardContent>
        </Card>
    );
}

function InvoiceListBody({
    invoices,
    query,
}: {
    invoices: Invoice[];
    query: { isLoading: boolean; isError: boolean; refetch: () => unknown };
}) {
    const t = useTranslations("profile.invoices");

    if (query.isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <InlineLoader size="md" />
                <p className="text-muted-foreground text-sm mt-4">{t("loading")}</p>
            </div>
        );
    }

    // A query hook that renders nothing on failure leaves a blank card with
    // nothing to retry (CLAUDE.md gotcha 9).
    if (query.isError) {
        return (
            <CenteredEmptyState icon={Receipt} title={t("error")} description={t("errorDesc")}>
                <Button variant="outline" onClick={() => query.refetch()}>
                    {t("retry")}
                </Button>
            </CenteredEmptyState>
        );
    }

    if (invoices.length === 0) {
        return (
            <CenteredEmptyState icon={Receipt} title={t("empty")} description={t("emptyDesc")} />
        );
    }

    return <InvoiceTable invoices={invoices} />;
}

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
    const t = useTranslations("profile.invoices");

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t("columns.type")}</TableHead>
                        <TableHead>{t("columns.invoice")}</TableHead>
                        <TableHead>{t("columns.date")}</TableHead>
                        <TableHead className="text-right">{t("columns.amount")}</TableHead>
                        <TableHead>{t("columns.status")}</TableHead>
                        <TableHead className="text-right">{t("columns.actions")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.map((invoice) => (
                        <InvoiceRow key={invoice.id} invoice={invoice} />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
    const t = useTranslations("profile.invoices");

    return (
        <TableRow>
            {/* The server's answer, never re-derived here: it is the word
                printed at the head of the PDF, and that depends on the
                issuer's identity, which only the server knows. */}
            <TableCell className="font-medium">
                {t(`documentType.${invoice.documentType}`)}
            </TableCell>
            <TableCell>
                <span className="font-mono text-sm">{invoice.invoiceNumber}</span>
                {invoice.kind === "credit_note" && invoice.relatedInvoiceNumber && (
                    <Badge variant="outline" className="ml-2">
                        {t("creditNoteFor", { number: invoice.relatedInvoiceNumber })}
                    </Badge>
                )}
            </TableCell>
            <TableCell className="text-muted-foreground">
                {/* Paris, not the viewer's zone: this is the
                    date printed on the document itself. */}
                {new Date(invoice.issuedAt ?? invoice.createdAt).toLocaleDateString(
                    "fr-FR",
                    { timeZone: "Europe/Paris" }
                )}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold">
                {formatCurrency(invoice.amount, { currency: invoice.currency })}
            </TableCell>
            <TableCell>
                <Badge variant="outline" className={statusStyles[invoice.status]}>
                    {t(`status.${invoice.status}`)}
                </Badge>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
                <InvoiceActions invoiceId={invoice.id} />
            </TableCell>
        </TableRow>
    );
}

function InvoiceActions({ invoiceId }: { invoiceId: string }) {
    const t = useTranslations("profile.invoices");
    const emailInvoice = useEmailInvoice();

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => emailInvoice.mutate(invoiceId)}
                disabled={emailInvoice.isPending}
                className="h-8"
            >
                <Mail className="h-4 w-4 mr-1" />
                {t("sendByEmail")}
            </Button>
            <Button
                variant="ghost"
                size="sm"
                // A plain navigation in a new tab; the route answers the PDF
                // as an attachment.
                onClick={() => window.open(getInvoicePdfUrl(invoiceId), "_blank")}
                className="h-8"
            >
                <Download className="h-4 w-4 mr-1" />
                {t("download")}
            </Button>
        </>
    );
}
