"use client";

import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import { formatListingReference } from "@/lib/listing-reference";
import { formatCurrency } from "@/lib/currency";
import type { PendingDelivery } from "../types";
import { DataTable, DataTableColumnHeader, dateRangeFilterFn } from "./data-table";

interface DeliveriesTableProps {
  deliveries: PendingDelivery[];
  className?: string;
}

const STATUS_TONE: Record<string, string> = {
  PENDING:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  PICKED_UP:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  IN_TRANSIT:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  DELIVERED:
    "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

function DeliveryStatusBadge({ status }: { status: string }) {
  // The vocabulary the client and the driver already read, not the raw enum.
  const t = useTranslations("deliveries.shipmentStatus");
  const known = status in STATUS_TONE;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_TONE[status] ??
        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      {known ? t(status) : status}
    </span>
  );
}

/**
 * The runs under way, for staff (client_feedback_2026_10_21_spec.md §A5).
 *
 * The first column is the job's reference in the shared « PAR-CLA-100018 »
 * format rather than the first eight characters of a random id, and the driver
 * has a column of their own. The « Propositions » column and the « Assigner »
 * button are gone: the count was hard-coded to 0, and the dialog the button
 * opened was deleted when awarding moved to the job page.
 */
export function DeliveriesTable({ deliveries, className }: DeliveriesTableProps) {
  const t = useTranslations("shipments.table");

  const columns: ColumnDef<PendingDelivery>[] = useMemo(
    () => [
      {
        id: "reference",
        accessorFn: (row) => row.reference ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("reference")} />
        ),
        cell: ({ row }) =>
          row.original.reference ? (
            <ListingReference
              reference={row.original.reference}
              from={row.original.origin}
              to={row.original.destination}
            />
          ) : (
            <span className="font-mono text-xs text-muted-foreground">
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
        // The toolbar searches everything a person would read off the row.
        filterFn: (row, _id, filterValue) => {
          const value = String(filterValue).toLowerCase();
          const { title, origin, destination, driverName, reference } =
            row.original;
          return [
            title,
            origin,
            destination,
            driverName ?? "",
            reference ? formatListingReference(reference, origin, destination) : "",
          ].some((field) => field.toLowerCase().includes(value));
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
        id: "driver",
        accessorFn: (row) => row.driverName ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("driver")} />
        ),
        cell: ({ row }) =>
          row.original.driverName ? (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {row.original.driverName}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{t("noDriver")}</span>
          ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("status")} />
        ),
        cell: ({ row }) => <DeliveryStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("price")} />
        ),
        cell: ({ row }) => (
          <p className="font-mono font-medium text-foreground">
            {formatCurrency(row.original.price)}
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
    ],
    [t]
  );

  const sortFields = [
    { id: "reference", label: t("reference") },
    { id: "title", label: t("title") },
    { id: "driver", label: t("driver") },
    { id: "status", label: t("status") },
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
      initialSorting={[{ id: "createdDate", desc: true }]}
    />
  );
}
