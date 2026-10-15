"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FileText, Truck } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { InlineLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { formatCurrency } from "@/lib/currency";
import { ApiError } from "@/lib/fetcher";
import { periodBoundsIso, type PeriodKey } from "@/lib/statement-period";
import {
    earningsStatementUrl,
    useCarrierStatement,
    type EarningsItem,
    type EarningsResponse,
} from "../../hooks/useInvoices";
import { PeriodSelect } from "./PeriodSelect";

const payoutStyles: Record<string, string> = {
    scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    cancelled: "bg-muted text-muted-foreground",
};

/** The date printed on the relevé, in the zone it is printed in. */
const paris = (value: string | null) =>
    value
        ? new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
        : "—";

/**
 * The carrier's tab of the transaction history: one statement line per
 * delivered run, read from the ledger the relevé d'activité is printed from
 * (`GET /api/carrier/earnings`, billing_documents_spec.md §3).
 */
export function CarrierStatementPanel() {
    const t = useTranslations("profile.invoices.carrier");
    const [period, setPeriod] = useState<PeriodKey>("all");

    const bounds = useMemo(() => periodBoundsIso(period), [period]);
    const statement = useCarrierStatement(bounds);

    return (
        <Card>
            <CardHeader>
                <p className="text-sm text-muted-foreground">{t("description")}</p>

                {/* Above the results, so an empty or failed period can still
                    be changed and its relevé still downloaded. */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <PeriodSelect value={period} onChange={setPeriod} />

                    <Button asChild variant="outline">
                        <a href={earningsStatementUrl(bounds)}>
                            <FileText className="h-4 w-4" />
                            {t("downloadStatement")}
                        </a>
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                <StatementBody statement={statement} />
            </CardContent>
        </Card>
    );
}

function StatementBody({
    statement,
}: {
    statement: UseQueryResult<EarningsResponse>;
}) {
    const t = useTranslations("profile.invoices.carrier");
    const tShared = useTranslations("profile.invoices");
    const { data, isLoading, isError, refetch } = statement;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <InlineLoader size="md" />
                <p className="text-muted-foreground text-sm mt-4">{t("loading")}</p>
            </div>
        );
    }

    // A carrier role with no carrier file yet has carried nothing: the empty
    // state, not a failure — the same reading `useCompletedTrips` makes.
    const noCarrierFile =
        statement.error instanceof ApiError && statement.error.code === "CARRIER_NOT_FOUND";
    if (noCarrierFile || (!isError && data && data.items.length === 0)) {
        return (
            <CenteredEmptyState icon={Truck} title={t("empty")} description={t("emptyDesc")} />
        );
    }

    // Its own failure, not the requester tab's: a carrier record that cannot
    // be read must not blank the page (CLAUDE.md gotcha 9).
    if (isError || !data) {
        return (
            <CenteredEmptyState icon={Truck} title={t("error")} description={t("errorDesc")}>
                <Button variant="outline" onClick={() => refetch()}>
                    {tShared("retry")}
                </Button>
            </CenteredEmptyState>
        );
    }

    return (
        <div className="space-y-3">
            <StatementTable data={data} />
            {data.total > data.items.length && (
                <p className="text-xs text-muted-foreground">
                    {t("truncated", { shown: data.items.length, total: data.total })}
                </p>
            )}
        </div>
    );
}

function StatementTable({ data }: { data: EarningsResponse }) {
    const t = useTranslations("profile.invoices.carrier");
    const { summary } = data;

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t("columns.date")}</TableHead>
                        <TableHead>{t("columns.job")}</TableHead>
                        <TableHead>{t("columns.reference")}</TableHead>
                        <TableHead className="text-right">{t("columns.gross")}</TableHead>
                        <TableHead className="text-right">{t("columns.commission")}</TableHead>
                        <TableHead className="text-right">{t("columns.net")}</TableHead>
                        <TableHead>{t("columns.payout")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.items.map((item) => (
                        <StatementRow key={item.shipmentId} item={item} />
                    ))}
                </TableBody>
                {/* The period's totals, from the server's summary rather than
                    a sum of the rows shown: it still holds when the list is
                    cut at the page ceiling. */}
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="font-medium">
                            {t("total", { count: summary.deliveries })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                            {formatCurrency(summary.grossCents)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                            {formatCurrency(summary.commissionCents)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(summary.netCents)}
                        </TableCell>
                        <TableCell />
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}

function StatementRow({ item }: { item: EarningsItem }) {
    const t = useTranslations("profile.invoices.carrier");

    return (
        <TableRow>
            <TableCell className="text-muted-foreground whitespace-nowrap">
                {paris(item.deliveredAt)}
            </TableCell>
            <TableCell className="min-w-[10rem]">
                <Link href={`/deliveries/${item.shipmentId}`} className="font-medium hover:underline">
                    {item.listingTitle ?? t("untitled")}
                </Link>
                <p className="text-xs text-muted-foreground">
                    {item.pickupCity} → {item.dropoffCity}
                </p>
            </TableCell>
            <TableCell className="font-mono text-sm">{item.reference}</TableCell>
            <TableCell className="text-right font-mono">
                {formatCurrency(item.grossCents)}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
                {formatCurrency(item.commissionCents)}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold">
                {formatCurrency(item.netCents)}
            </TableCell>
            <TableCell>
                {item.payoutStatus ? (
                    <Badge variant="outline" className={payoutStyles[item.payoutStatus]}>
                        {t(`payout.${item.payoutStatus}`)}
                    </Badge>
                ) : (
                    <span className="text-sm text-muted-foreground">{t("payout.none")}</span>
                )}
            </TableCell>
        </TableRow>
    );
}
