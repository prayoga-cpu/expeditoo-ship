"use client";

import { useMemo, useState } from "react";
import { MoreVertical, Send, Tag, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/features/app/admin/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import { AssignDriverDialog } from "./AssignDriverDialog";
import { EscalateDialog } from "./EscalateDialog";
import { RepriceDialog } from "./RepriceDialog";

/**
 * One operator queue, with the actions that clear it.
 *
 * The actions live on the row rather than behind a detail page because the
 * queue *is* the workflow: an operator works down it pricing and assigning, and
 * a round trip through a detail view for each one is the friction this replaces.
 *
 * Every action opens a dialog rather than firing on click. Escalation is
 * irreversible and the other two take a value, so none of them is a safe
 * single-click.
 */

export type QueueColumn = "price" | "storage" | "escalation" | "client";

export interface QuoteQueueTableProps {
  rows: QuoteRow[];
  /** Which context column to show beside the shared ones. */
  extraColumn: QueueColumn;
  emptyTitle: string;
  emptyDescription: string;
}

function money(cents: number | null): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Whole days from now until [date]; negative once it has passed. */
function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export function QuoteQueueTable({
  rows,
  extraColumn,
  emptyTitle,
  emptyDescription,
}: QuoteQueueTableProps) {
  const [reprice, setReprice] = useState<QuoteRow | null>(null);
  const [assign, setAssign] = useState<QuoteRow | null>(null);
  const [escalate, setEscalate] = useState<QuoteRow | null>(null);
  const t = useTranslations("admin.expedion");

  const columns = useMemo<ColumnDef<QuoteRow>[]>(() => {
    const base: ColumnDef<QuoteRow>[] = [
      {
        accessorKey: "reference",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.reference")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.reference ?? row.original.id.slice(0, 8)}
          </span>
        ),
        // Searching a queue means searching everything visible on the row, not
        // just the reference column the toolbar is pointed at.
        filterFn: (row, _id, value) => {
          const q = String(value).toLowerCase();
          return [
            row.original.reference,
            row.original.auctionHouseName,
            row.original.deliveryCity,
            row.original.clientName,
          ].some((field) => (field ?? "").toLowerCase().includes(q));
        },
      },
      {
        accessorKey: "auctionHouseName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.auctionHouse")}
          />
        ),
        cell: ({ row }) => row.original.auctionHouseName ?? "—",
      },
      {
        accessorKey: "deliveryCity",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.delivery")} />
        ),
        cell: ({ row }) => row.original.deliveryCity ?? "—",
      },
    ];

    const contextColumn: Record<QueueColumn, ColumnDef<QuoteRow>> = {
      price: {
        id: "price",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.amount")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {money(row.original.priceCents)}
          </span>
        ),
      },
      storage: {
        id: "storage",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.storage")} />
        ),
        cell: ({ row }) => {
          const days = daysUntil(row.original.storageFreeUntil);
          if (days === null) return "—";
          return (
            <Badge variant={days <= 0 ? "destructive" : "secondary"}>
              {days <= 0 ? t("table.billed") : `J-${days}`}
            </Badge>
          );
        },
      },
      escalation: {
        id: "escalation",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.escalation")} />
        ),
        // Without pickup coordinates the escalation service refuses the job, so
        // the timer can run forever and nothing will happen. Say so here rather
        // than letting the operator discover it by clicking.
        cell: ({ row }) =>
          row.original.hasPickupCoords ? (
            <Badge variant="secondary">{t("table.ready")}</Badge>
          ) : (
            <Badge variant="destructive">{t("table.missingCoords")}</Badge>
          ),
      },
      client: {
        id: "client",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.client")} />
        ),
        cell: ({ row }) =>
          row.original.owned ? (
            (row.original.clientName ?? "—")
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-500">
              {t("table.airtableImport")}
            </span>
          ),
      },
    };

    return [
      ...base,
      contextColumn[extraColumn],
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("table.actions")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setReprice(row.original)}>
                <Tag className="mr-2 h-4 w-4" />
                {t("actions.reprice")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssign(row.original)}>
                <Truck className="mr-2 h-4 w-4" />
                {t("actions.assign")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setEscalate(row.original)}
                disabled={!row.original.hasPickupCoords}
              >
                <Send className="mr-2 h-4 w-4" />
                {t("actions.escalate")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];
  }, [extraColumn, t]);

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground px-6 py-10 text-center">
        <p className="text-foreground text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 text-sm">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchKey="reference"
        searchPlaceholder={t("table.searchPlaceholder")}
        tableMinHeight="auto"
      />
      <RepriceDialog quote={reprice} onClose={() => setReprice(null)} />
      <AssignDriverDialog quote={assign} onClose={() => setAssign(null)} />
      <EscalateDialog quote={escalate} onClose={() => setEscalate(null)} />
    </>
  );
}
