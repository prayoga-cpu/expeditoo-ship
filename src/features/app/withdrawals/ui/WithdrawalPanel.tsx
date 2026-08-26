"use client";

import { RefreshCw, Wallet, WalletMinimal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  useRequestWithdrawal,
  useWithdrawalBalance,
} from "../hooks/useWithdrawals";
import type { Withdrawal } from "../api/withdrawals.api";

/** Theme tokens, so the badge reads in light and dark alike. */
const TONE: Record<Withdrawal["status"], string> = {
  requested: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  paid: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * What the driver has earned, and the one button that asks for it.
 *
 * The money is not sent automatically — every payment is captured into the
 * platform's account, so a withdrawal is a request an operator answers. The
 * copy says so rather than implying an instant transfer.
 */
export function WithdrawalPanel() {
  const t = useTranslations("withdrawals");
  const format = useFormatter();
  const { data, isLoading, isError, refetch, isRefetching } =
    useWithdrawalBalance();
  const request = useRequestWithdrawal();

  if (isLoading) return <PageLoader />;

  // A failed balance call used to `return null`, which rendered the driver an
  // entirely blank screen — no heading, no error, nothing to retry. The page
  // stayed blank for as long as the endpoint was broken and said nothing about
  // why, so the only way to find out was the browser console.
  if (isError || !data) {
    return (
      <CenteredEmptyState
        icon={WalletMinimal}
        title={t("loadFailed")}
        description={t("loadFailedHint")}
        variant="page"
      >
        <Button
          type="button"
          variant="outline"
          disabled={isRefetching}
          onClick={() => refetch()}
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefetching && "animate-spin")}
          />
          {t("retry")}
        </Button>
      </CenteredEmptyState>
    );
  }

  const open = data.openRequest;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t("available")}</p>
              <p className="font-mono text-3xl font-medium tabular-nums">
                {formatCurrency(data.availableCents)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("fromDeliveries", { count: data.deliveries })}
              </p>
            </div>
          </div>

          {open ? (
            <div className="rounded-lg border border-border bg-input p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={TONE[open.status]}>
                  {t(`status.${open.status}`)}
                </Badge>
                <span className="font-mono tabular-nums">
                  {formatCurrency(open.amountCents)}
                </span>
                <span className="text-muted-foreground">
                  {format.dateTime(new Date(open.createdAt), {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">
                {t(`openHint.${open.status}`)}
              </p>
            </div>
          ) : (
            <Button
              type="button"
              disabled={!data.canRequest || request.isPending}
              onClick={() => request.mutate()}
            >
              {request.isPending ? t("requesting") : t("requestCta")}
            </Button>
          )}

          {!open && !data.canRequest && data.availableCents > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("belowMinimum", {
                minimum: formatCurrency(data.minimumCents),
              })}
            </p>
          )}

          <p className="text-xs text-muted-foreground">{t("footnote")}</p>
        </div>
      </Card>

      {data.history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">{t("historyTitle")}</h2>
          <div className="space-y-2">
            {data.history.map((row) => (
              <Card
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={TONE[row.status]}>
                    {t(`status.${row.status}`)}
                  </Badge>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(row.amountCents)}
                  </span>
                </div>
                <div className="text-right text-muted-foreground">
                  <div>
                    {format.dateTime(new Date(row.createdAt), {
                      dateStyle: "medium",
                    })}
                  </div>
                  {row.reference && (
                    <div className="font-mono text-xs">{row.reference}</div>
                  )}
                  {row.decisionNote && (
                    <div className="text-xs">{row.decisionNote}</div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
