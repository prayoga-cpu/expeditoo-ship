"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ClipboardList, Gavel, MapPin, Plus, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";
import type { Job, ListingStatus } from "@/features/app/listing/types";
import { useMyJobs } from "./useMyJobs";

const STATUSES: ListingStatus[] = [
  "draft",
  "open",
  "awarded",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
];

/** Theme-token tones so the badge reads correctly in light and dark. */
const STATUS_TONE: Record<ListingStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  open: "bg-success/15 text-success border-success/30",
  awarded: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-warning/15 text-warning border-warning/30",
};

/** Every job the shipper has posted, in any state. */
export function MyJobs() {
  const t = useTranslations("myJobs");
  const [status, setStatus] = useState<ListingStatus | "all">("all");
  const { data: jobs, isLoading, isError } = useMyJobs(
    status === "all" ? undefined : status
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ListingStatus | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.all")}</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/create">
              <Plus className="h-4 w-4" />
              {t("postJob")}
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <CenteredEmptyState
          variant="page"
          icon={AlertTriangle}
          title={t("loadFailed")}
        />
      ) : !jobs || jobs.length === 0 ? (
        <CenteredEmptyState
          variant="page"
          icon={ClipboardList}
          title={status === "all" ? t("empty") : t("emptyFiltered")}
          description={
            status === "all" ? t("emptyDesc") : t("emptyFilteredDesc")
          }
        >
          {status === "all" && (
            <Button asChild>
              <Link href="/create">{t("postJob")}</Link>
            </Button>
          )}
        </CenteredEmptyState>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const t = useTranslations("myJobs");

  return (
    <Link href={`/listing/${job.id}`} className="block">
      <Card className="group cursor-pointer p-4 transition-colors hover:border-primary/40 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_TONE[job.status]}>
                {t(`status.${job.status}`)}
              </Badge>
              {job.origin === "expedion" && (
                <Badge variant="secondary">via Expedion</Badge>
              )}
            </div>
            <h3 className="mt-2 truncate text-lg font-semibold text-foreground group-hover:text-primary">
              {job.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {job.pickupCity} → {job.dropoffCity}
              </span>
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-lg font-semibold">
              {formatCurrency(job.budgetCents)}
            </p>
            <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
              <Gavel className="h-3.5 w-3.5" />
              {t("offers", { count: job.offersCount })}
            </p>
          </div>
        </div>

        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          {t("posted", { date: format(new Date(job.createdAt), "d MMM yyyy") })}
        </p>
      </Card>
    </Link>
  );
}
