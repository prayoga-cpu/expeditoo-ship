"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import { STATUS_TONE, displayStatus } from "@/features/app/listing/statusTone";
import type { ListingStatus } from "@/features/app/listing/types";
import { useLeaveAdminNav } from "@/lib/use-leave-admin-nav";
import { cn } from "@/lib/utils";
import type { ActivityJobView } from "../../api/user-activity.api";

/** Theme tokens, so a status reads in light and in dark. */
const OFFER_TONE: Record<string, string> = {
  pending: "bg-primary/15 text-primary border-primary/30",
  accepted: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  declined: "bg-destructive/15 text-destructive border-destructive/30",
  withdrawn: "bg-muted text-muted-foreground border-border",
  expired: "bg-warning/15 text-warning border-warning/30",
};

/** `d MMM yyyy`, or with the time, in the reader's language. */
export function useActivityDate() {
  const locale = useLocale() === "fr" ? fr : enUS;
  return (value: string, withTime = false) =>
    format(new Date(value), withTime ? "d MMM yyyy HH:mm" : "d MMM yyyy", { locale });
}

export function ListingStatusBadge({
  status,
  expiresAt,
}: {
  status: string;
  expiresAt?: string | null;
}) {
  const t = useTranslations("admin.userActivity.listingStatus");
  const shown = displayStatus({ status: status as ListingStatus, expiresAt });
  return (
    <Badge variant="outline" className={cn("text-xs", STATUS_TONE[shown])}>
      {t.has(shown) ? t(shown) : shown}
    </Badge>
  );
}

/** An `offers` status or a `thread_offers` one — the two share this copy. */
export function OfferStatusBadge({ status }: { status: string }) {
  const label = useOfferStatusLabel();
  return (
    <Badge variant="outline" className={cn("text-xs", OFFER_TONE[status])}>
      {label(status)}
    </Badge>
  );
}

export function useOfferStatusLabel() {
  const t = useTranslations("admin.userActivity.offerStatus");
  return (status: string) => (t.has(status) ? t(status) : status);
}

/** « 100042 · Titre » and « Lyon → Marseille ». Towns only, by design. */
export function JobLine({ job }: { job: ActivityJobView }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 font-medium text-foreground">
        <ListingReference reference={job.reference} className="text-muted-foreground" />
        <span className="break-words">{job.title}</span>
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <span>{job.pickupCity}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{job.dropoffCity}</span>
      </p>
    </div>
  );
}

/**
 * To the job page. It renders in `MainLayout`, which bounces Admin mode back
 * to the panel, so the mode is left before the push (`useLeaveAdminNav`).
 */
export function OpenJobButton({ jobId }: { jobId: string }) {
  const t = useTranslations("admin.userActivity");
  const open = useLeaveAdminNav();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => open(`/listing/${jobId}`)}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      {t("openJob")}
    </Button>
  );
}

/** One row of a list: content left, the way on at the right (below on a phone). */
export function ActivityRow({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}
