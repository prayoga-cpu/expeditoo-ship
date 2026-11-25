"use client";

import { LoadErrorState } from "@/components/ui/load-error-state";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/hooks/useDateLocale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Incident, IncidentSeverity, IncidentStatus } from "../api";

/**
 * What has been reported on this run, for whoever is looking at it.
 *
 * Both parties see the same list. An incident one side raised is not a secret
 * from the other — the point of filing one is that the other side and an
 * operator find out.
 */

/** Tokens only, so both themes come out of the palette rather than a guess. */
const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  low: "border-border text-muted-foreground",
  medium: "tone-warning",
  high: "tone-danger",
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: "tone-danger",
  ACKNOWLEDGED:
    "tone-warning",
  RESOLVED:
    "tone-success",
};

interface IncidentListProps {
  incidents: Incident[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry: () => void;
}

export function IncidentList({
  incidents,
  isLoading = false,
  isError = false,
  onRetry,
}: IncidentListProps) {
  const t = useTranslations("incidents");
  const locale = useDateLocale();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Never a silent empty list on failure: that is how a 500 renders as "all
  // clear" to the one person who needed to see it (CLAUDE.md §Gotchas 9).
  if (isError) {
    return (
      <LoadErrorState variant="inline" title={t("list.error")} onRetry={onRetry} />
    );
  }

  if (!incidents.length) {
    return <p className="text-sm text-muted-foreground">{t("list.empty")}</p>;
  }

  return (
    <ul className="space-y-3">
      {incidents.map((incident) => (
        <li
          key={incident.id}
          className="rounded-lg border border-border bg-card p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {t(`categories.${incident.category}`)}
            </span>
            <Badge
              variant="outline"
              className={SEVERITY_STYLES[incident.severity]}
            >
              {t(`severities.${incident.severity}`)}
            </Badge>
            <Badge variant="outline" className={STATUS_STYLES[incident.status]}>
              {t(`statuses.${incident.status}`)}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(incident.createdAt), {
                addSuffix: true,
                locale,
              })}
            </span>
          </div>

          <p className="mt-2 text-sm whitespace-pre-wrap">
            {incident.description}
          </p>

          {incident.photoUrls.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {incident.photoUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            {t("list.reportedBy", {
              name: incident.reporter.name ?? t("list.unknownReporter"),
              role: t(`roles.${incident.reporter.role}`),
            })}
          </p>

          {incident.resolutionNote && (
            <p className="mt-2 rounded-md border tone-success p-2 text-xs">
              {t("list.resolution")}: {incident.resolutionNote}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
