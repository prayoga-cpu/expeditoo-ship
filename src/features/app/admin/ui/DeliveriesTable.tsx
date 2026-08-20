"use client";

import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus, MapPin, Calendar } from "lucide-react";
import type { PendingDelivery } from "../types";
import { useTranslations } from "next-intl";
import { DataTable, DataTableColumnHeader, dateRangeFilterFn } from "./data-table";

interface DeliveriesTableProps {
  deliveries: PendingDelivery[];
  onAssignClick: (delivery: PendingDelivery) => void;
  className?: string;
}

function formatPrice(priceInCents: number): string {
  return `€${(priceInCents / 100).toFixed(2)}`;
}

// Status badge component
function DeliveryStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
    assigned:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    delivered:
      "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  };

  const defaultStyle =
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status.toLowerCase()] || defaultStyle}`}
    >
      {status}
    </span>
  );
}

export function DeliveriesTable({
  deliveries,
  onAssignClick,
  className,
}: DeliveriesTableProps) {
  const t = useTranslations("shipments.table");

  // Define columns for TanStack Table
  const columns: ColumnDef<PendingDelivery>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("id")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            #{row.original.id.slice(0, 8).toUpperCase()}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("title")} />
        ),
        cell: ({ row }) => (
          <p className="font-medium text-foreground">{row.original.title}</p>
        ),
        filterFn: (row, id, filterValue) => {
          const title = row.original.title.toLowerCase();
          const origin = row.original.origin.toLowerCase();
          const destination = row.original.destination.toLowerCase();
          const value = (filterValue as string).toLowerCase();
          return (
            title.includes(value) ||
            origin.includes(value) ||
            destination.includes(value)
          );
        },
      },
      {
        id: "route",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("route")} />
        ),
        cell: ({ row }) => (
          <p className="text-sm text-muted-foreground">
            {row.original.origin} → {row.original.destination}
          </p>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("status")} />
        ),
        cell: ({ row }) => <DeliveryStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "proposalCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("proposals")} />
        ),
        cell: ({ row }) => {
          const count = row.original.proposalCount;
          return (
             <div className="flex items-center gap-2">
                <span className={`font-medium ${count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {count}
                </span>
                {count > 0 && <span className="text-xs text-muted-foreground">proposals</span>}
             </div>
          );
        },
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("price")} />
        ),
        cell: ({ row }) => (
          <p className="font-medium text-foreground">
            {formatPrice(row.original.price)}
          </p>
        ),
      },
      {
        accessorKey: "createdDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("created")} />
        ),
        cell: ({ row }) => (
          <p className="text-sm text-muted-foreground">
            {new Date(row.original.createdDate).toLocaleDateString()}
          </p>
        ),
        filterFn: dateRangeFilterFn<PendingDelivery>(),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actions")}</span>,
        cell: ({ row }) => {
          const isAssignable = row.original.status.toLowerCase() === "pending";
          return (
            <div className="text-right">
              <Button
                size="sm"
                onClick={() => onAssignClick(row.original)}
                className="gap-1"
                disabled={!isAssignable}
                variant={isAssignable ? "default" : "secondary"}
              >
                <UserPlus className="w-4 h-4" />
                {t("assign")}
              </Button>
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sortFields = [
    { id: "title", label: t("title") },
    { id: "status", label: t("status") },
    { id: "proposalCount", label: t("proposals") },
    { id: "price", label: t("price") },
    { id: "createdDate", label: t("created") },
  ];

  return (
    <DataTable
      columns={columns}
      data={deliveries}
      searchKey="title"
      searchPlaceholder={t("searchPlaceholder")}
      className={className}
      dateFilterKey="createdDate"
      sortFields={sortFields}
    />
  );
}
