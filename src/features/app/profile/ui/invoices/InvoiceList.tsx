"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import {
    useInvoices,
    getInvoicePdfUrl,
    getInvoiceStatementUrl,
} from "../../hooks/useInvoices";
import { InlineLoader } from "@/components/ui/page-loader";
import { periodBoundsIso, type PeriodKey } from "@/lib/statement-period";

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
    const [period, setPeriod] = useState<PeriodKey>("all");

    const bounds = useMemo(() => periodBoundsIso(period), [period]);
    const { data, isLoading, error } = useInvoices(bounds);

    const handleDownload = (invoiceId: string) => {
        // Open PDF in new tab for download
        window.open(getInvoicePdfUrl(invoiceId), "_blank");
    };

    const invoices = data?.items ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t("title")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t("description")}</p>

                {/* The controls sit above the results rather than inside them:
                    an empty period is precisely when you need to change the
                    period, so they must survive the empty state. */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <Select
                        value={period}
                        onValueChange={(value) => setPeriod(value as PeriodKey)}
                    >
                        <SelectTrigger className="sm:w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("periods.all")}</SelectItem>
                            <SelectItem value="this_month">{t("periods.thisMonth")}</SelectItem>
                            <SelectItem value="last_month">{t("periods.lastMonth")}</SelectItem>
                            <SelectItem value="this_year">{t("periods.thisYear")}</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button asChild variant="outline">
                        <a href={getInvoiceStatementUrl(bounds)}>
                            <Download className="h-4 w-4" />
                            {t("downloadPeriod")}
                        </a>
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <InlineLoader size="md" />
                        <p className="text-muted-foreground text-sm mt-4">{t("loading")}</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                            <Receipt className="h-8 w-8 text-destructive" />
                        </div>
                        <h3 className="font-semibold text-lg">{t("error")}</h3>
                        <p className="text-muted-foreground text-sm mt-1">{t("errorDesc")}</p>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Receipt className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg">{t("empty")}</h3>
                        <p className="text-muted-foreground text-sm mt-1">{t("emptyDesc")}</p>
                    </div>
                ) : (
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
                )}
            </CardContent>
        </Card>
    );
}
