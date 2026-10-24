"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CronJobStatus } from "../api/platform-settings.api";
import { useCronStatus } from "../hooks/useLaunchReadiness";

type State = CronJobStatus["state"];

const ICON: Record<State, typeof CheckCircle2> = {
  ok: CheckCircle2,
  late: Clock,
  failing: XCircle,
  never: AlertTriangle,
};

const TONE: Record<State, string> = {
  ok: "text-success",
  late: "text-warning",
  failing: "text-destructive",
  never: "text-destructive",
};

/**
 * « Tâches planifiées » — whether the jobs that expire requests, publish paid
 * quotes and scheduled requests, and check driver documents have run, and
 * when (client_feedback_2026_10_21_spec.md §X1). Red with the fix spelled out
 * when one has never run: that was every one of them in production, and the
 * only symptom was requests from September still reading « Ouverte ».
 */
export function CronStatusPanel() {
  const t = useTranslations("platformSettings.cron");
  const format = useFormatter();
  const { data, isLoading, isError, refetch, isFetching } = useCronStatus();

  const anyNever = (data ?? []).some((job) => job.state === "never");

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t("refresh")}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError || !data ? (
        <CenteredEmptyState
          icon={AlertTriangle}
          title={t("error")}
          description={t("errorBody")}
        />
      ) : (
        <>
          {anyNever ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive">{t("neverTitle")}</p>
              <p className="mt-1 text-foreground/80">{t("neverBody")}</p>
            </div>
          ) : null}
          <ul className="divide-y rounded-lg border">
            {data.map((job) => {
              const Icon = ICON[job.state];
              return (
                <li key={job.job} className="flex items-start gap-3 p-3">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE[job.state])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t(`jobs.${job.job}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.lastRunAt
                        ? t("lastRun", {
                            date: format.dateTime(new Date(job.lastRunAt), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }),
                          })
                        : t("neverRun")}
                      {" · "}
                      {t(`every.${job.job}`)}
                    </p>
                    {job.state === "failing" && job.lastError ? (
                      <p className="mt-1 break-words text-xs text-destructive">
                        {job.lastError}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className={cn("shrink-0", TONE[job.state])}>
                    {t(`state.${job.state}`)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
