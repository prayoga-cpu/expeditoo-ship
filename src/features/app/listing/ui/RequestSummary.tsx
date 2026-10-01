"use client";

import type { ReactNode } from "react";
import { CalendarClock, MapPin, Package, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Job } from "../types";

type SummaryJob = Pick<
  Job,
  | "title"
  | "pickupCity"
  | "dropoffCity"
  | "pickupFrom"
  | "pickupUntil"
  | "dropoffFrom"
  | "dropoffUntil"
  | "isFlexible"
  | "packagingLevel"
  | "needsProtection"
  | "needsPackaging"
  | "isFragile"
  | "needsHelp"
  | "weightKg"
  | "quantity"
>;

interface RequestSummaryProps {
  job: SummaryJob;
  /** Sizes the title for its surface; the rest of the summary does not change. */
  titleClassName?: string;
}

const WINDOW_FORMAT = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
} as const;

/**
 * A request as its requester needs to read it back: what, from where to where,
 * when, and how it is protected (request_summary_spec.md §2).
 *
 * Shared by the `/home` card and the `/listings/me` rows so the two cannot
 * drift apart. Cities only, never street addresses: this is a summary, and the
 * full addresses are one tap away on the job page.
 */
export function RequestSummary({ job, titleClassName }: RequestSummaryProps) {
  const t = useTranslations("myJobs.summary");
  const tDetail = useTranslations("myJobs.detail");
  const format = useFormatter();

  const range = (from: string, until: string) =>
    format.dateTimeRange(new Date(from), new Date(until), WINDOW_FORMAT);

  // How the item is prepared, then what the carrier is asked to do with it
  // (cargo_packaging_services_spec.md §1), in the job page's own words. With
  // neither said it reads "not stated", never "unprotected": the schema's
  // rule for `packaging_level`.
  const stated = [
    job.packagingLevel ? tDetail(`packaging.${job.packagingLevel}`) : null,
    job.needsProtection ? tDetail("needsProtection") : null,
    job.needsPackaging ? tDetail("needsPackaging") : null,
  ].filter(Boolean);
  const protection = [
    ...(stated.length > 0 ? stated : [t("protectionNone")]),
    job.isFragile ? t("fragile") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const load = [
    t("weight", { weight: job.weightKg }),
    job.quantity > 1 ? t("quantity", { count: job.quantity }) : null,
    job.needsHelp ? t("needsHelp") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3">
      {/* Title and route on one line, as the client asked; wraps only when the
          width runs out. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className={cn("min-w-0 font-medium wrap-break-word", titleClassName)}>
          {job.title}
        </h3>
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          <span className="wrap-break-word">
            {job.pickupCity} → {job.dropoffCity}
          </span>
        </p>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <SummaryItem icon={CalendarClock} label={t("pickup")}>
          {range(job.pickupFrom, job.pickupUntil)}
        </SummaryItem>
        <SummaryItem icon={CalendarClock} label={t("dropoff")}>
          {range(job.dropoffFrom, job.dropoffUntil)}
        </SummaryItem>
        <SummaryItem icon={ShieldCheck} label={t("protection")}>
          {protection}
        </SummaryItem>
        <SummaryItem icon={Package} label={t("load")}>
          {load}
        </SummaryItem>
      </dl>

      {job.isFlexible && (
        <p className="text-xs text-muted-foreground">{t("flexible")}</p>
      )}
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="wrap-break-word">{children}</dd>
      </div>
    </div>
  );
}
