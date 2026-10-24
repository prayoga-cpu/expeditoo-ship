"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Gavel, LayoutGrid, List, Rows3 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { STATUS_TONE, displayStatus } from "../statusTone";
import type { Job } from "../types";
import { ListingReference } from "./ListingReference";
import { UrgentBadge } from "./UrgentBadge";

/**
 * The three ways to look at one's own requests (client feedback 2026-10-21,
 * §D1–D2: « liste, carte ou gros plan »):
 *
 * - `list` — one line each, many on screen at once;
 * - `cards` — a grid of small cards;
 * - `detailed` — the full summary per request, as « Mes demandes » always was.
 *
 * « Carte » is read as *card*: the request asked for « plusieurs affichages »
 * of the same requests, and a map view is a different feature that would need
 * its own answer (the spec records the question).
 */
export type RequestView = "list" | "cards" | "detailed";

export const REQUEST_VIEWS: readonly RequestView[] = ["list", "cards", "detailed"];

const STORAGE_KEY = "expeditoo.myRequests.view";

const isRequestView = (value: unknown): value is RequestView =>
  typeof value === "string" && (REQUEST_VIEWS as readonly string[]).includes(value);

/**
 * The viewer's chosen view, remembered in this browser. A convenience only:
 * storage can be blocked or empty, and the page renders the default then.
 */
export function useRequestView(fallback: RequestView = "detailed") {
  const [view, setView] = useState<RequestView>(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isRequestView(stored)) setView(stored);
    } catch {
      // Private window or blocked storage: keep the default.
    }
  }, []);

  const choose = (next: RequestView) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered; the choice still applies to this visit.
    }
  };

  return { view, setView: choose };
}

const VIEW_ICON = { list: List, cards: LayoutGrid, detailed: Rows3 } as const;

/** Three icon buttons, one pressed. */
export function RequestViewSwitcher({
  view,
  onChange,
}: {
  view: RequestView;
  onChange: (view: RequestView) => void;
}) {
  const t = useTranslations("myJobs.views");

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="inline-flex items-center rounded-lg border bg-muted p-0.5"
    >
      {REQUEST_VIEWS.map((option) => {
        const Icon = VIEW_ICON[option];
        const active = view === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            title={t(option)}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t(option)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** « 8 oct. » or « 8 oct. – 31 oct. » for a flexible window. */
function usePickupDay(job: Job) {
  const format = useFormatter();
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "short" });
  return job.isFlexible
    ? `${day(job.pickupFrom)} – ${day(job.pickupUntil)}`
    : day(job.pickupFrom);
}

function StatusBadge({ job, className }: { job: Job; className?: string }) {
  const t = useTranslations("myJobs");
  const status = displayStatus(job);
  return (
    <Badge className={cn(STATUS_TONE[status], className)}>
      {t(`status.${status}`)}
    </Badge>
  );
}

/** One request on one line: status, title, route and day, price and bids. */
export function RequestCompactRow({ job }: { job: Job }) {
  const t = useTranslations("myJobs");
  const pickupDay = usePickupDay(job);

  return (
    <Link
      href={`/listing/${job.id}`}
      data-testid="request-compact-row"
      className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      {/* Status and urgency stacked in their own column, so a narrow screen
          never squeezes the title down to a letter to make room for them. */}
      <div className="flex shrink-0 flex-col items-start gap-1">
        <StatusBadge job={job} />
        <UrgentBadge job={job} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium group-hover:text-primary">
          {job.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {job.pickupCity} → {job.dropoffCity} · {pickupDay}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold tabular-nums">
          {formatCurrency(job.budgetCents)}
        </p>
        <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <Gavel className="h-3 w-3" aria-hidden />
          {t("offers", { count: job.offersCount })}
        </p>
      </div>
    </Link>
  );
}

/** One request as a small card, for the grid view. */
export function RequestTile({ job }: { job: Job }) {
  const t = useTranslations("myJobs");
  const pickupDay = usePickupDay(job);

  return (
    <Link href={`/listing/${job.id}`} className="group block h-full">
      <Card className="flex h-full flex-col gap-2 p-4 transition-colors group-hover:border-primary/40">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge job={job} />
          <UrgentBadge job={job} />
        </div>
        <p className="line-clamp-2 font-semibold group-hover:text-primary">
          {job.title}
        </p>
        <ListingReference
          reference={job.reference}
          from={job.pickupCity}
          to={job.dropoffCity}
        />
        <p className="text-sm text-muted-foreground">
          {job.pickupCity} → {job.dropoffCity}
        </p>
        <p className="text-xs text-muted-foreground">{pickupDay}</p>
        <div className="mt-auto flex items-end justify-between gap-2 border-t pt-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Gavel className="h-3 w-3" aria-hidden />
            {t("offers", { count: job.offersCount })}
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {formatCurrency(job.budgetCents)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

/**
 * The dashboard's requests block: every live request on one line each, the
 * first {@link limit} of them, and a way to the rest (§D1). Replaces the one
 * full-size card that showed only the newest request.
 */
export function RequestsDigest({
  jobs,
  limit = 4,
}: {
  jobs: Job[];
  limit?: number;
}) {
  const t = useTranslations("dashboard.myRequests");
  if (jobs.length === 0) return null;
  const shown = jobs.slice(0, limit);

  return (
    <Card className="gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          {t("title", { count: jobs.length })}
        </h2>
        <Link
          href="/listings/me"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("all")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div className="space-y-2">
        {shown.map((job) => (
          <RequestCompactRow key={job.id} job={job} />
        ))}
      </div>
      {jobs.length > shown.length ? (
        <p className="text-xs text-muted-foreground">
          {t("more", { count: jobs.length - shown.length })}
        </p>
      ) : null}
    </Card>
  );
}
