"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Download, FileText, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useInvoices, getInvoicePdfUrl } from "../../hooks/useInvoices";
import { InlineLoader } from "@/components/ui/page-loader";

// Type for invoice status
type InvoiceStatus = "draft" | "issued" | "paid" | "void";

const statusStyles: Record<InvoiceStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    issued: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    void: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function InvoiceList() {
    const t = useTranslations("profile.invoices");
    const { data, isLoading, error } = useInvoices();

    const handleDownload = (invoiceId: string) => {
        // Open PDF in new tab for download
        window.open(getInvoicePdfUrl(invoiceId), "_blank");
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <InlineLoader size="md" />
                    <p className="text-muted-foreground text-sm mt-4">{t("loading")}</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <Receipt className="h-8 w-8 text-destructive" />
                    </div>
                    <h3 className="font-semibold text-lg">{t("error")}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{t("errorDesc")}</p>
                </CardContent>
            </Card>
        );
    }

    const invoices = data?.items ?? [];

    if (invoices.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Receipt className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg">{t("empty")}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{t("emptyDesc")}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t("title")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t("description")}</p>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("columns.invoice")}</TableHead>
                                <TableHead>{t("columns.date")}</TableHead>
                                <TableHead className="text-right">{t("columns.amount")}</TableHead>
                                <TableHead>{t("columns.status")}</TableHead>
                                <TableHead className="text-right">{t("columns.actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-medium">
                                        {invoice.invoiceNumber}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {invoice.issuedAt
                                            ? new Date(invoice.issuedAt).toLocaleDateString()
                                            : new Date(invoice.createdAt).toLocaleDateString()
                                        }
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        €{(invoice.amount / 100).toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={statusStyles[invoice.status]}>
                                            {t(`status.${invoice.status}`)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(invoice.id)}
                                            className="h-8"
                                        >
                                            <Download className="h-4 w-4 mr-1" />
                                            {t("download")}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
