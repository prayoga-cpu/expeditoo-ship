"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  CheckCircle2,
  CircleDashed,
  CreditCard,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StripeCheckKey, StripeStatus } from "../api/platform-settings.api";
import { useStripeStatus } from "../hooks/useLaunchReadiness";

type CheckState = StripeStatus["checks"][number]["state"];

const ICON: Record<CheckState, typeof CheckCircle2> = {
  ok: CheckCircle2,
  todo: CircleDashed,
  fail: XCircle,
};

const TONE: Record<CheckState, string> = {
  ok: "text-success",
  todo: "text-warning",
  fail: "text-destructive",
};

/** One line under each check, saying what was actually seen. */
function useDetail(status: StripeStatus) {
  const t = useTranslations("platformSettings.stripe");
  const format = useFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const here = status.webhooks.reachable
    ? status.webhooks.endpoints.find((e) => e.kind === "thisApp")
    : undefined;

  return (key: StripeCheckKey): string => {
    switch (key) {
      case "liveKeys":
        return t("detail.keys", {
          secret: t(`mode.${status.secretKeyMode}`),
          publishable: t(`mode.${status.publishableKeyMode}`),
        });
      case "mockOff":
        return t(status.mockPayments ? "detail.mockOn" : "detail.mockOff");
      case "chargesEnabled":
        return status.account.reachable
          ? t("detail.account", { name: status.account.name ?? status.account.id })
          : t("detail.unreachable", { error: status.account.error });
      case "webhookEndpoint":
        if (!status.webhooks.reachable) {
          return t("detail.unreachable", { error: status.webhooks.error });
        }
        return here
          ? t("detail.endpoint", { url: here.url, status: here.status })
          : t("detail.noEndpoint");
      case "webhookReceived":
        return status.lastEvent
          ? t("detail.lastEvent", {
              type: status.lastEvent.type,
              date: date(status.lastEvent.at),
              mode: t(`mode.${status.lastEvent.livemode ? "live" : "test"}`),
            })
          : t("detail.noEvent");
      case "firstRealPayment":
        return status.payments.firstRealAt
          ? t("detail.payments", {
              count: status.payments.realCount,
              date: date(status.payments.firstRealAt),
            })
          : t("detail.noPayment");
    }
  };
}

function Checklist({ status }: { status: StripeStatus }) {
  const t = useTranslations("platformSettings.stripe");
  const detail = useDetail(status);

  return (
    <ul className="space-y-3">
      {status.checks.map(({ key, state }) => {
        const Icon = ICON[state];
        return (
          <li key={key} className="flex items-start gap-3">
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TONE[state])} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{t(`checks.${key}`)}</p>
              <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {detail(key)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Endpoints on the same Stripe account that are not this app's. */
function OtherEndpoints({ status }: { status: StripeStatus }) {
  const t = useTranslations("platformSettings.stripe");
  if (!status.webhooks.reachable) return null;
  const others = status.webhooks.endpoints.filter((e) => e.kind !== "thisApp");
  if (others.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-sm font-medium">{t("others.title")}</p>
      <p className="text-xs text-muted-foreground">{t("others.hint")}</p>
      <ul className="space-y-1.5">
        {others.map((endpoint) => (
          <li key={endpoint.url} className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{endpoint.status}</Badge>
            <span className="font-mono [overflow-wrap:anywhere]">{endpoint.url}</span>
            {endpoint.kind === "thisPathOtherHost" && (
              <span className="text-warning">{t("others.otherHost")}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Whether this deployment can take real card payments, checked from inside it
 * (launch_readiness_spec.md §B). Read-only: it asks Stripe and the database,
 * and changes nothing in either.
 */
export function StripeStatusPanel() {
  const t = useTranslations("platformSettings.stripe");
  const { data, isLoading, isError, refetch, isFetching } = useStripeStatus();

  const refresh = (
    <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
      <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      {t("refresh")}
    </Button>
  );

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  if (isError || !data) {
    return (
      <Card className="p-5">
        <CenteredEmptyState icon={CreditCard} title={t("loadFailed")} description={t("loadFailedHint")}>
          {refresh}
        </CenteredEmptyState>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        {refresh}
      </div>
      <Checklist status={data} />
      <OtherEndpoints status={data} />
    </Card>
  );
}
