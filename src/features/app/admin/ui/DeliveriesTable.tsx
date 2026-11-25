"use client";

import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useLocale, useTranslations } from "next-intl";
import { Truck } from "lucide-react";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import { RequesterCell } from "./RequesterCell";
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
    "tone-warning",
  ASSIGNED: "tone-info",
  PICKED_UP:
    "tone-info",
  IN_TRANSIT:
    "tone-info",
  DELIVERED:
    "tone-success",
  CANCELLED: "tone-danger",
};

function DeliveryStatusBadge({ status }: { status: string }) {
  // The vocabulary the client and the driver already read, not the raw enum.
  const t = useTranslations("deliveries.shipmentStatus");
  const known = status in STATUS_TONE;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_TONE[status] ??
        "tone-neutral"
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
  const locale = useLocale();

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
            <ListingReference reference={row.original.reference} />
          ) : (
            <span className="font-mono text-xs text-muted-foreground">
              #{row.original.id.slice(0, 8).toUpperCase()}
            </span>
          ),
      },
      {
        id: "departure",
        accessorKey: "origin",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("departure")} />
        ),
        cell: ({ row }) => <p className="text-sm">{row.original.origin}</p>,
      },
      {
        id: "arrival",
        accessorKey: "destination",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("arrival")} />
        ),
        cell: ({ row }) => (
          <p className="text-sm">{row.original.destination}</p>
        ),
      },
      {
        id: "requester",
        accessorFn: (row) => row.requesterName ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("requester")} />
        ),
        cell: ({ row }) => <RequesterCell name={row.original.requesterName} />,
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
          const {
            title,
            origin,
            destination,
            driverName,
            requesterName,
            reference,
          } = row.original;
          return [
            title,
            origin,
            destination,
            driverName ?? "",
            requesterName ?? "",
            reference ? formatListingReference(reference) : "",
          ].some((field) => field.toLowerCase().includes(value));
        },
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
            {new Date(row.original.createdDate).toLocaleDateString(locale)}
          </p>
        ),
        filterFn: dateRangeFilterFn<PendingDelivery>(),
      },
    ],
    [t, locale]
  );

  const sortFields = [
    { id: "reference", label: t("reference") },
    { id: "departure", label: t("departure") },
    { id: "arrival", label: t("arrival") },
    { id: "requester", label: t("requester") },
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
