"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, RotateCcw } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DataTable, DataTableColumnHeader, dateRangeFilterFn } from "./data-table";
import type { AdminPayment } from "../hooks/useAdminPayments";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/currency";

// Status badge
function PaymentStatusBadge({
    status,
    statusLabel,
}: {
    status: "pending" | "succeeded" | "failed" | "refunded";
    statusLabel: string;
}) {
    const styles = {
        pending: "bg-yellow-500 hover:bg-yellow-600 text-white",
        succeeded: "bg-green-500 hover:bg-green-600 text-white",
        failed: "bg-red-500 hover:bg-red-600 text-white",
        refunded: "bg-gray-500 hover:bg-gray-600 text-white",
    };

    return <Badge className={styles[status]}>{statusLabel}</Badge>;
}

// Actions
function PaymentActions({
    payment,
    onRefund,
    processRefundLabel,
    cannotRefundLabel,
}: {
    payment: AdminPayment;
    onRefund: (paymentId: string) => void;
    processRefundLabel: string;
    cannotRefundLabel: string;
}) {
    const canRefund = payment.status === "succeeded";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => onRefund(payment.id)}
                    disabled={!canRefund}
                    className={canRefund ? "" : "opacity-50 cursor-not-allowed"}
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {canRefund ? processRefundLabel : cannotRefundLabel}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface PaymentsTableProps {
    payments: AdminPayment[];
    onRefund: (paymentId: string, reason?: string) => void;
    isRefunding?: boolean;
}

export function PaymentsTable({
    payments,
    onRefund,
    isRefunding,
    className,
}: PaymentsTableProps & { className?: string }) {
    const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
    const [refundReason, setRefundReason] = useState<string>("requested_by_customer");
    const t = useTranslations("admin.payments");
    const tTable = useTranslations("admin.payments.table");
    const tStatus = useTranslations("admin.payments.status");
    const tActions = useTranslations("admin.payments.actions");
    const tDialog = useTranslations("admin.payments.refundDialog");

    const handleRefundClick = (id: string) => {
        setRefundPaymentId(id);
    };

    const confirmRefund = () => {
        if (refundPaymentId) {
            onRefund(refundPaymentId, refundReason);
            setRefundPaymentId(null);
            setRefundReason("requested_by_customer");
        }
    };

    const columns: ColumnDef<AdminPayment>[] = useMemo(
        () => [
            {
                accessorKey: "id",
                header: ({ column }) => (
                    <DataTableColumnHeader column={column} title={tTable("id")} />
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-xs">
                        {row.original.id.slice(0, 8)}...
                    </span>
                ),
            },
            {
                accessorKey: "userName",
                header: ({ column }) => (
                    <DataTableColumnHeader column={column} title={tTable("user")} />
                ),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">
                            {row.original.userName || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {row.original.userEmail}
                        </span>
                    </div>
                ),
                filterFn: (row, _id, filterValue) => {
                    const name = (row.original.userName || "").toLowerCase();
                    const email = (row.original.userEmail || "").toLowerCase();
                    const value = (filterValue as string).toLowerCase();
                    return name.includes(value) || email.includes(value);
                },
            },
            {
                accessorKey: "amount",
                header: ({ column }) => (
                    <DataTableColumnHeader column={column} title={tTable("amount")} />
                ),
                cell: ({ row }) => (
                    <span className="font-medium">
                        {formatCurrency(row.original.amount, { currency: row.original.currency })}
                    </span>
                ),
            },
            {
                accessorKey: "status",
                header: ({ column }) => (
                    <DataTableColumnHeader column={column} title={tTable("status")} />
                ),
                cell: ({ row }) => (
                    <PaymentStatusBadge 
                        status={row.original.status} 
                        statusLabel={tStatus(row.original.status)}
                    />
                ),
            },
            {
                accessorKey: "createdAt",
                header: ({ column }) => (
                    <DataTableColumnHeader column={column} title={tTable("date")} />
                ),
                cell: ({ row }) => (
                    <span className="text-muted-foreground">
                        {new Date(row.original.createdAt).toLocaleDateString()}
                    </span>
                ),
                filterFn: dateRangeFilterFn<AdminPayment>(),
            },
            {
                id: "actions",
                header: () => <span className="sr-only">{tTable("actions")}</span>,
                cell: ({ row }) => (
                    <div className="text-right">
                        <PaymentActions
                            payment={row.original}
                            onRefund={handleRefundClick}
                            processRefundLabel={tActions("processRefund")}
                            cannotRefundLabel={tActions("cannotRefund")}
                        />
                    </div>
                ),
                enableSorting: false,
                enableHiding: false,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    return (
        <>
            <DataTable
                columns={columns}
                data={payments}
                searchKey="userName"
                searchPlaceholder={tTable("searchPlaceholder")}
                className={className}
                dateFilterKey="createdAt"
            />

            <AlertDialog
                open={!!refundPaymentId}
                onOpenChange={(open) => !open && setRefundPaymentId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{tDialog("title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {tDialog("description")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">
                            {tDialog("reasonLabel")}
                        </label>
                        <Select value={refundReason} onValueChange={setRefundReason}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="requested_by_customer">
                                    {tDialog("requestedByCustomer")}
                                </SelectItem>
                                <SelectItem value="duplicate">{tDialog("duplicate")}</SelectItem>
                                <SelectItem value="fraudulent">{tDialog("fraudulent")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRefunding}>{tDialog("cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmRefund();
                            }}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isRefunding}
                        >
                            {isRefunding ? (
                                <LottieLoader width={20} height={20} className="mr-2" />
                            ) : null}
                            {isRefunding ? tDialog("processing") : tDialog("confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
