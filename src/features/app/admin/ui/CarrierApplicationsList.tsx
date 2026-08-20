"use client";

import { useState, useMemo, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Eye, Inbox } from "lucide-react";
import { CarrierApplicationDetail } from "./CarrierApplicationDetail";
import { CarrierStatusBadge } from "./CarrierStatusBadge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCarrierApplications } from "../hooks/useCarrierApplications";
import {
  ALL_STATUSES,
  CARRIER_APPLICATION_STATUSES,
  type CarrierApplication,
  type CarrierApplicationFilter,
} from "../api/carriers.api";
import { useTranslations, useLocale } from "next-intl";
import { DataTable, DataTableColumnHeader, dateRangeFilterFn } from "./data-table";

export function CarrierApplicationsList({
  tableMinHeight,
}: {
  tableMinHeight?: string;
}) {
  // Unfiltered by default: an admin lands on the whole queue and narrows it
  // themselves, rather than on a slice that hides applications.
  const [status, setStatus] = useState<CarrierApplicationFilter>(ALL_STATUSES);
  const {
    applications,
    isLoading,
    approveApplication,
    rejectApplication,
    suspendCarrierAccount,
    isUpdating,
  } = useCarrierApplications(status);
  const [selectedApplication, setSelectedApplication] =
    useState<CarrierApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const t = useTranslations("admin.carriers");
  const locale = useLocale();

  const dateLocale = locale === "fr" ? fr : enUS;

  const handleViewDetail = useCallback((app: CarrierApplication) => {
    setSelectedApplication(app);
    setIsDetailOpen(true);
  }, []);

  // The mutation hook invalidates the query; here we only close the dialog.
  const handleDetailDone = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  // Column definitions for TanStack Table
  const columns: ColumnDef<CarrierApplication>[] = useMemo(
    () => [
      {
        accessorKey: "companyName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.company")} />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.companyName}</div>
            <div className="text-xs font-mono text-muted-foreground">
              {row.original.siret}
            </div>
          </div>
        ),
        filterFn: (row, id, filterValue) => {
          const value = (filterValue as string).toLowerCase();
          const { companyName, siret, user } = row.original;
          return [companyName, siret, user.name, user.email].some((field) =>
            field.toLowerCase().includes(value)
          );
        },
      },
      {
        accessorKey: "user",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.applicant")} />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.user.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.user.email}
            </div>
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "city",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.city")} />
        ),
        cell: ({ row }) => (
          <span>
            {row.original.postalCode} {row.original.city}
          </span>
        ),
      },
      {
        id: "fleet",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.fleet")} />
        ),
        cell: ({ row }) => (
          <span>
            {t("table.vehicleCount", { count: row.original.vehicles.length })}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "documents",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.documents")} />
        ),
        cell: ({ row }) => (
          <span>
            {t("table.documentCount", { count: row.original.documents.length })}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.date")} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {format(new Date(row.original.createdAt), "dd MMM yyyy", {
              locale: dateLocale,
            })}
          </span>
        ),
        filterFn: dateRangeFilterFn<CarrierApplication>(),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.status")} />
        ),
        cell: ({ row }) => <CarrierStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.actions")}</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewDetail(row.original)}
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateLocale]
  );

  return (
    <div className="space-y-4">
      <Select
        value={status}
        onValueChange={(value) => setStatus(value as CarrierApplicationFilter)}
      >
        <SelectTrigger
          className="w-[200px]"
          aria-label={t("table.filterLabel")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>{t("table.filterAll")}</SelectItem>
          {CARRIER_APPLICATION_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`status.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? (
        <PageLoader />
      ) : applications.length === 0 ? (
        <CenteredEmptyState
          icon={Inbox}
          title={t("table.empty.title")}
          description={
            status === ALL_STATUSES
              ? t("table.empty.descriptionAll")
              : t("table.empty.description")
          }
          variant="page"
        />
      ) : (
        <DataTable
          columns={columns}
          data={applications}
          searchKey="companyName"
          searchPlaceholder={t("table.searchPlaceholder")}
          tableMinHeight={tableMinHeight}
          dateFilterKey="createdAt"
        />
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          {selectedApplication && (
            <CarrierApplicationDetail
              application={selectedApplication}
              isUpdating={isUpdating}
              onApprove={approveApplication}
              onReject={rejectApplication}
              onSuspend={suspendCarrierAccount}
              onDone={handleDetailDone}
              onClose={() => setIsDetailOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
