"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { formatCurrency } from "@/lib/currency";
import {
  useDecideWithdrawal,
  useWithdrawalQueue,
} from "../hooks/useWithdrawals";
import type { ReviewRow } from "../api/withdrawals.api";

const TONE: Record<ReviewRow["status"], string> = {
  requested: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  paid: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * The operator's side: who is asking, for how much, and the three answers.
 *
 * Approving does not move money — the transfer is made by hand — so the button
 * that records payment asks for its reference. A payment recorded with nothing
 * to reconcile it against is worse than one not recorded at all.
 */
export function WithdrawalQueue() {
  const t = useTranslations("withdrawals");
  const format = useFormatter();
  const [status, setStatus] = useState<string | undefined>("requested");
  const { data: rows, isLoading } = useWithdrawalQueue(status);
  const decide = useDecideWithdrawal();
  const [reference, setReference] = useState<Record<string, string>>({});

  const filters = ["requested", "approved", "paid", "rejected"] as const;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("queueTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("queueSubtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={status === f ? "default" : "outline"}
            onClick={() => setStatus(f)}
          >
            {t(`status.${f}`)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={status === undefined ? "default" : "outline"}
          onClick={() => setStatus(undefined)}
        >
          {t("all")}
        </Button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !rows || rows.length === 0 ? (
        <CenteredEmptyState title={t("queueEmpty")} description={t("queueEmptyHint")} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={TONE[row.status]}>
                      {t(`status.${row.status}`)}
                    </Badge>
                    <span className="font-mono text-lg tabular-nums">
                      {formatCurrency(row.amountCents)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {row.carrierName ?? row.carrierEmail}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.carrierEmail} ·{" "}
                    {format.dateTime(new Date(row.createdAt), {
                      dateStyle: "medium",
                    })}
                  </p>
                  {row.reference && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {row.reference}
                    </p>
                  )}
                </div>

                {(row.status === "requested" || row.status === "approved") && (
                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    {row.status === "requested" && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({
                              id: row.id,
                              input: { action: "approve" },
                            })
                          }
                        >
                          {t("approve")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({
                              id: row.id,
                              input: { action: "reject" },
                            })
                          }
                        >
                          {t("reject")}
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        aria-label={t("referenceLabel")}
                        placeholder={t("referencePlaceholder")}
                        value={reference[row.id] ?? ""}
                        onChange={(e) =>
                          setReference((r) => ({ ...r, [row.id]: e.target.value }))
                        }
                        className="h-9 w-full sm:w-48"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={decide.isPending || !reference[row.id]?.trim()}
                        onClick={() =>
                          decide.mutate({
                            id: row.id,
                            input: {
                              action: "mark_paid",
                              reference: reference[row.id],
                            },
                          })
                        }
                      >
                        {t("markPaid")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
