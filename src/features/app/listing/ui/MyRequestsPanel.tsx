"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Gavel, Plus, AlertTriangle, TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
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
import { useMyRequests } from "../hooks/useMyRequests";
import { RequestSummary } from "./RequestSummary";
import { ListingReference } from "./ListingReference";
import { DraftActions } from "./DraftActions";
import { STATUS_TONE } from "../statusTone";
import type { Job, ListingStatus } from "../types";

const STATUSES: ListingStatus[] = [
  "draft",
  "scheduled",
  "open",
  "awarded",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
];

/** Every request the caller has posted, in any state. */
export function MyRequestsPanel() {
  const t = useTranslations("myJobs");
  const [status, setStatus] = useState<ListingStatus | "all">("all");
  const {
    data: jobs,
    isLoading,
    isError,
  } = useMyRequests(status === "all" ? undefined : status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
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

/** Not yet seen by anyone but its author: still to be finished. */
const isUnpublished = (job: Job) => job.status === "draft" || job.status === "scheduled";

function JobRow({ job }: { job: Job }) {
  const t = useTranslations("myJobs");

  // The card is a link to the request; the actions on a request not yet live
  // sit below it, outside the link (draft_requests_spec.md §1).
  return (
    <Card className="group p-4 transition-colors hover:border-primary/40 sm:p-5">
      <Link href={`/listing/${job.id}`} className="block cursor-pointer">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_TONE[job.status]}>
                {t(`status.${job.status}`)}
              </Badge>
              <ListingReference reference={job.reference} />
            </div>
            <div className="mt-2">
              <RequestSummary
                job={job}
                titleClassName="text-lg font-semibold text-foreground group-hover:text-primary"
              />
            </div>
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

        <RowDate job={job} />
      </Link>

      {isUnpublished(job) && <DraftActions job={job} className="mt-3" />}
    </Card>
  );
}

/**
 * The date that matters for where the request is: when a draft was last
 * saved, when a scheduled one goes live, when a live one really went live —
 * not when it was first written (draft_requests_spec.md §5). « Publiée le »
 * only from `publishedAt`: a request that never went live — expired by the
 * scheduler, cancelled while scheduled — says when it was written instead.
 */
function RowDate({ job }: { job: Job }) {
  const t = useTranslations("myJobs");
  const format = useFormatter();
  const day = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const datesPassed = job.status === "draft" && new Date(job.pickupUntil) < new Date();

  const label =
    job.status === "draft"
      ? t("savedOn", { date: day(job.updatedAt ?? job.createdAt) })
      : job.status === "scheduled" && job.scheduledPublishAt
        ? t("scheduledFor", {
            date: format.dateTime(new Date(job.scheduledPublishAt), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })
        : job.publishedAt
          ? t("posted", { date: day(job.publishedAt) })
          : t("created", { date: day(job.createdAt) });

  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
      <span>{label}</span>
      {datesPassed && (
        // Amber on the icon only: amber text on the card is under 4.5:1.
        <span className="flex items-center gap-1 font-medium text-foreground">
          <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden />
          {t("draft.datesPassed")}
        </span>
      )}
    </p>
  );
}
