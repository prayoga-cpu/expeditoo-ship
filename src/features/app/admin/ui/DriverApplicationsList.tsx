"use client";

import { useState, useMemo, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { DriverApplicationDetail } from "./DriverApplicationDetail";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { PageLoader } from "@/components/ui/page-loader";
import { useDriverApplications } from "../hooks/useDriverApplications";
import type { DriverApplication } from "../api/drivers.api";
import { useTranslations, useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, DataTableColumnHeader } from "./data-table";

// Status badge component
function ApplicationStatusBadge({
  status,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const styles = {
    APPROVED: "bg-green-500 hover:bg-green-600 text-white",
    REJECTED: "bg-red-500 hover:bg-red-600 text-white",
    PENDING: "bg-orange-500 hover:bg-orange-600 text-white",
  };

  const labels = {
    APPROVED: "Approved",
    REJECTED: "Rejected",
    PENDING: "Pending",
  };

  return <Badge className={styles[status]}>{labels[status]}</Badge>;
}

export function DriverApplicationsList({ tableMinHeight }: { tableMinHeight?: string }) {
  const { applications, isLoading } = useDriverApplications();
  const [selectedApplication, setSelectedApplication] =
    useState<DriverApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const t = useTranslations("admin.drivers.table");
  const locale = useLocale();

  const dateLocale = locale === "fr" ? fr : enUS;
  const queryClient = useQueryClient();

  const handleViewDetail = useCallback((app: DriverApplication) => {
    setSelectedApplication(app);
    setIsDetailOpen(true);
  }, []);

  // Callback for Detail Component
  const handleDetailUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["driver-applications"] });
    queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    setIsDetailOpen(false);
  }, [queryClient]);

  const pendingApplications = useMemo(
    () => applications.filter((app) => app.status === "PENDING"),
    [applications]
  );

  // Column definitions for TanStack Table
  const columns: ColumnDef<DriverApplication>[] = useMemo(
    () => [
      {
        accessorKey: "user",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("applicant")} />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.user.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.user.email}
            </div>
          </div>
        ),
        filterFn: (row, id, filterValue) => {
          const name = row.original.user.name.toLowerCase();
          const email = row.original.user.email.toLowerCase();
          const value = (filterValue as string).toLowerCase();
          return name.includes(value) || email.includes(value);
        },
      },
      {
        accessorKey: "vehicleType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("vehicle")} />
        ),
        cell: ({ row }) => <span>{row.original.vehicleType}</span>,
      },
      {
        accessorKey: "vehiclePlate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("licensePlate")} />
        ),
        cell: ({ row }) => <span>{row.original.vehiclePlate}</span>,
      },
      {
        accessorKey: "siret",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("siret")} />
        ),
        cell: ({ row }) => (
          <span>{row.original.documents ? t("verified") : t("pending")}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("date")} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {format(
              new Date(row.original.createdAt || new Date()),
              "dd MMM yyyy",
              {
                locale: dateLocale,
              }
            )}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("status")} />
        ),
        cell: ({ row }) => (
          <ApplicationStatusBadge
            status={row.original.status as "PENDING" | "APPROVED" | "REJECTED"}
          />
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actions")}</span>,
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

  if (isLoading) {
    return <PageLoader variant="admin" />;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={pendingApplications}
        searchKey="user"
        searchPlaceholder={t("searchPlaceholder") || "Search applications..."}
        tableMinHeight={tableMinHeight}
      />


      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          {selectedApplication && (
            <DriverApplicationDetail
              application={selectedApplication}
              onUpdate={handleDetailUpdate}
              onClose={() => setIsDetailOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
