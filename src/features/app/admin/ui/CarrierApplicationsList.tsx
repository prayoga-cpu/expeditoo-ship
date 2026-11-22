"use client";

import { LoadErrorState } from "@/components/ui/load-error-state";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Eye, Inbox } from "lucide-react";
import { CarrierApplicationDetail } from "./CarrierApplicationDetail";
import { CarrierStatusBadge } from "./CarrierStatusBadge";
import { isAbsent } from "@/lib/carrier-availability";
import { CARRIER_KINDS, carrierKindLabel } from "@/lib/carrier-kind";
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
  type CarrierApplication,
} from "../api/carriers.api";
import {
  DRIVER_TABS,
  defaultTab,
  documentProgress,
  matchesFilters,
  tabCounts,
  type DriverTab,
  type KindFilter,
} from "../lib/carrier-actions";
import { useTranslations, useLocale } from "next-intl";
import { DataTable, DataTableColumnHeader, dateRangeFilterFn } from "./data-table";

export function CarrierApplicationsList({
  tableMinHeight,
}: {
  tableMinHeight?: string;
}) {
  // One unfiltered fetch; the tabs and filters narrow it here, so every tab can
  // show its count (driver_page_management_spec.md §3).
  const [tab, setTab] = useState<DriverTab | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [notReachedOnly, setNotReachedOnly] = useState(false);
  const {
    applications,
    isLoading,
    error,
    refetch,
    approveApplication,
    rejectApplication,
    suspendCarrierAccount,
    setAvailability,
    setContactConfirmed,
    deregisterCarrierAccount,
    reinstateCarrierAccount,
    saveFile,
    addVehicle,
    isUpdating,
  } = useCarrierApplications(ALL_STATUSES);
  const [selectedApplication, setSelectedApplication] =
    useState<CarrierApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const t = useTranslations("admin.carriers");
  const locale = useLocale();

  const counts = useMemo(() => tabCounts(applications, kind), [applications, kind]);
  // Land on what waits for a decision, else on the working pool — until the
  // admin picks a tab themselves.
  const activeTab = tab ?? defaultTab(counts);
  const visible = useMemo(
    () =>
      applications.filter((application) =>
        matchesFilters(application, { tab: activeTab, kind, notReachedOnly })
      ),
    [applications, activeTab, kind, notReachedOnly]
  );
  const filtersActive = kind !== "all" || notReachedOnly || activeTab !== "all";
  const resetFilters = () => {
    setTab("all");
    setKind("all");
    setNotReachedOnly(false);
  };

  const dateLocale = locale === "fr" ? fr : enUS;

  const handleViewDetail = useCallback((app: CarrierApplication) => {
    setSelectedApplication(app);
    setIsDetailOpen(true);
  }, []);

  // `?file=<id>` opens that file: the admin alert (mail and bell) links to
  // the application itself, so an in-house driver waiting on one click is not
  // also waiting on a search. Once per id — closing the dialog must not
  // reopen it while the parameter is still in the URL.
  const linkedFileId = useSearchParams()?.get("file") ?? null;
  const openedFromLink = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedFileId || openedFromLink.current === linkedFileId) return;
    const linked = applications.find((application) => application.id === linkedFileId);
    if (!linked) return;
    openedFromLink.current = linkedFileId;
    handleViewDetail(linked);
  }, [linkedFileId, applications, handleViewDetail]);

  // The mutation hook invalidates the query; here we only close the dialog.
  const handleDetailDone = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  // Column definitions for TanStack Table
  const columns: ColumnDef<CarrierApplication>[] = useMemo(
    () => [
      // The person leads: it is a driver the admin is managing, not a company.
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
      // Straight after the applicant, not last: on a tablet this table scrolls
      // sideways and the status — the one thing an admin came for — sat past the
      // edge, so a pending file looked like it had no status at all.
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.status")} />
        ),
        cell: ({ row }) => (
          <CarrierStatusBadge
            status={row.original.status}
            absent={isAbsent(row.original)}
          />
        ),
      },
      {
        accessorKey: "kind",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.type")} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">{carrierKindLabel(row.original.kind, locale)}</Badge>
        ),
      },
      {
        accessorKey: "companyName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.company")} />
        ),
        cell: ({ row }) => (
          <div>
            {/* An in-house driver has no company and no SIRET: say what they are. */}
            <div className="font-medium">
              {row.original.kind === "private"
                ? carrierKindLabel("private", locale)
                : row.original.companyName}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {row.original.siret ?? ""}
            </div>
          </div>
        ),
        filterFn: (row, id, filterValue) => {
          const value = (filterValue as string).toLowerCase();
          const { companyName, siret, user } = row.original;
          return [companyName, siret ?? "", user.name, user.email].some((field) =>
            field.toLowerCase().includes(value)
          );
        },
      },
      {
        id: "contact",
        header: () => t("table.contact"),
        cell: ({ row }) => {
          // Only meaningful while the file waits for a decision.
          const waiting =
            row.original.status === "submitted" ||
            row.original.status === "under_review";
          if (!waiting) return <span className="text-muted-foreground">—</span>;
          return row.original.contactConfirmedAt ? (
            <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-500">
              <Check className="w-4 h-4" />
              {t("table.reached")}
            </span>
          ) : (
            <span className="text-sm text-amber-600 dark:text-amber-500">
              {t("table.notReached")}
            </span>
          );
        },
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
        cell: ({ row }) => {
          const { accepted, total } = documentProgress(row.original);
          return total === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span>{t("table.documentProgress", { accepted, total })}</span>
          );
        },
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
        id: "actions",
        header: () => <span className="sr-only">{t("table.actions")}</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("table.open")}
              onClick={(e) => {
                // The row itself opens the same detail on click; without this
                // the button's own click would bubble up and fire it twice.
                e.stopPropagation();
                handleViewDetail(row.original);
              }}
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
    [dateLocale, locale]
  );

  const sortFields = [
    { id: "companyName", label: t("table.company") },
    { id: "city", label: t("table.city") },
    { id: "createdAt", label: t("table.date") },
    { id: "status", label: t("table.status") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* One scrolling row: six tabs do not fit a phone. */}
        <div className="overflow-x-auto">
          <Tabs value={activeTab} onValueChange={(v) => setTab(v as DriverTab)}>
            <TabsList>
              {DRIVER_TABS.map((value) => (
                <TabsTrigger key={value} value={value} className="gap-2 px-3">
                  {t(`tabs.${value}`)}
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {counts[value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
            <SelectTrigger className="w-[180px]" aria-label={t("table.kindFilterLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("table.kindAll")}</SelectItem>
              {CARRIER_KINDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {carrierKindLabel(value, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={notReachedOnly ? "default" : "outline"}
            aria-pressed={notReachedOnly}
            onClick={() => setNotReachedOnly((on) => !on)}
          >
            {t("table.notReachedOnly")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <LoadErrorState onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <CenteredEmptyState
          icon={Inbox}
          title={t("table.empty.title")}
          description={
            applications.length === 0
              ? t("table.empty.descriptionAll")
              : t("table.empty.description")
          }
          variant="page"
        >
          {applications.length > 0 && filtersActive && (
            <Button variant="outline" onClick={resetFilters}>
              {t("table.resetFilters")}
            </Button>
          )}
        </CenteredEmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchKey="companyName"
          searchPlaceholder={t("table.searchPlaceholder")}
          tableMinHeight={tableMinHeight}
          dateFilterKey="createdAt"
          sortFields={sortFields}
          onRowClick={handleViewDetail}
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
              onSetAvailability={setAvailability}
              onSetContactConfirmed={setContactConfirmed}
              onSaveFile={saveFile}
              onAddVehicle={addVehicle}
              onDeregister={deregisterCarrierAccount}
              onReinstate={reinstateCarrierAccount}
              onDone={handleDetailDone}
              onClose={() => setIsDetailOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
