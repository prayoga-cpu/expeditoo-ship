"use client";

import {
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Gavel,
  Package,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/features/app/admin/ui/StatCard";
import type { ExpedionReportSection } from "@/server/services/expedion-report.service";

import { useExpedionReport } from "../hooks/useExpedionReport";
import { QuoteQueueTable, type QueueColumn } from "./QuoteQueueTable";
import { RecentQuotesPanel } from "./RecentQuotesPanel";

/**
 * The operator report — Expedion quotes and the Expeditoo marketplace they
 * escalate into, on one page.
 *
 * A client component, not a server one, for a reason worth recording: this
 * app's `i18n/request.ts` always returns the default locale on the server and
 * nothing calls `getTranslations` from `next-intl/server`, so a server
 * component can only ever render French. It also needs React Query for the
 * inline actions. The data comes from one endpoint so no two figures on the
 * page can disagree.
 */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

function money(cents: number): string {
  return EUR.format(cents / 100);
}

function count(value: number): string {
  return value.toLocaleString("fr-FR");
}

/**
 * The funnel, in the order `canTransition` allows movement through it. Each
 * entry is both the status column value and the `funnel.*` message key.
 */
const FUNNEL = [
  "pending",
  "awaiting_confirmation",
  "quoted",
  "accepted",
  "paid",
  "assigned",
  "escalated",
  "picked_up",
  "delivered",
] as const;

const QUEUES: {
  key: "toPrice" | "needsDriver" | "storageAtRisk" | "escalationDue";
  column: QueueColumn;
}[] = [
  { key: "toPrice", column: "price" },
  { key: "needsDriver", column: "client" },
  { key: "storageAtRisk", column: "storage" },
  { key: "escalationDue", column: "escalation" },
];

export function ExpedionDashboard() {
  const { data, isLoading, error } = useExpedionReport();
  const t = useTranslations("admin.expedion");

  if (isLoading) return <PageLoader />;

  if (error || !data) {
    return (
      <div className="text-destructive flex items-center justify-center gap-2 p-10">
        <AlertCircle className="h-6 w-6" />
        {/* `||`, not `??`: an Error carrying an empty message is still no
            message, and nullish-coalescing would render an empty red box. */}
        <span>{error?.message || t("error")}</span>
      </div>
    );
  }

  const { quotes, statuses, marketplace, health, series, queues, platform } =
    data;

  // A section whose query threw still arrives, zero-filled, so the rest of the
  // page can render — which means a placeholder nought is indistinguishable
  // from a counted one unless we say so. `unavailable` names them; anything it
  // names becomes the em-dash this page already uses for "cannot say", because
  // "0 € collected" is a far worse thing to show an operator than nothing.
  const missing = new Set<ExpedionReportSection>(data.unavailable ?? []);
  const figure = (section: ExpedionReportSection, value: string) =>
    missing.has(section) ? "—" : value;

  const byStatus = new Map(statuses.map((s) => [s.status, s.count]));
  const actionable =
    quotes.awaitingPricing + quotes.needsDriver + quotes.escalationDue;

  // Cents on the wire; recharts wants a plain number, so divide once here.
  const chartData = series.map((point) => ({
    name: point.name,
    total: point.acceptedCents / 100,
    quotes: point.quotes,
  }));

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Gavel className="text-primary h-8 w-8" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* ---- What arrived and what needs doing, before any figure ---- */}
      <RecentQuotesPanel rows={data.recent} unavailable={missing.has("recent")} />

      {/* ---- KPIs: the auction business, then the platform around it ---- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t("kpi.quotes")}
          value={figure("quotes", count(quotes.total))}
          icon={Gavel}
          hint={t("kpi.quotesHint", {
            count: figure("quotes", count(quotes.unowned)),
          })}
        />
        <StatCard
          label={t("kpi.actionable")}
          value={figure("quotes", count(actionable))}
          icon={AlertTriangle}
          hint={t("kpi.actionableHint")}
          tone={actionable > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t("kpi.collected")}
          value={figure("quotes", money(quotes.paidValueCents))}
          icon={DollarSign}
          hint={t("kpi.collectedHint", {
            value: figure("quotes", money(quotes.acceptedValueCents)),
          })}
          // Collected is not "how much money arrived" — it counts quotes whose
          // paymentStatus reached `paid`, which only ever happens if Expedion
          // reports the settlement to us. Nothing here observes Stripe, so a
          // zero means "nothing reported". MOCK_PAYMENTS was never the reason.
          footnote={
            data.provisional.paymentsUnobserved
              ? t("kpi.reportedPayments")
              : undefined
          }
        />
        <StatCard
          label={t("kpi.commission")}
          value={figure("platform", money(platform.appFeesCents))}
          icon={DollarSign}
          hint={t("kpi.commissionHint")}
          footnote={
            data.provisional.mockPayments
              ? `${t("kpi.beforeStripe")} ${t("kpi.mockPayments")}`
              : t("kpi.beforeStripe")
          }
        />
        <StatCard
          label={t("kpi.carriers")}
          value={figure("marketplace", count(marketplace.carriersApproved))}
          icon={Truck}
          hint={t("kpi.carriersHint", {
            pending: figure("marketplace", count(marketplace.carriersPending)),
            active: figure("platform", count(platform.activeDrivers)),
          })}
        />
        <StatCard
          label={t("kpi.deliveries")}
          value={figure("platform", count(platform.pendingDeliveries))}
          icon={Package}
          hint={t("kpi.deliveriesHint", {
            count: figure("platform", count(platform.activeUsers)),
          })}
        />
      </div>

      {/* ---- Funnel + value over time ---- */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-7">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("funnel.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {FUNNEL.map((status) => {
              const value = byStatus.get(status) ?? 0;
              // Proportion of everything, so the bars are comparable down the
              // funnel rather than each being scaled to itself.
              const share = quotes.total === 0 ? 0 : value / quotes.total;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-muted-foreground w-32 shrink-0 text-xs">
                    {t(`funnel.${status}`)}
                  </span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded">
                    <div
                      className="bg-primary h-full rounded"
                      style={{ width: `${Math.max(share * 100, value > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-xs">
                    {figure("statuses", count(value))}
                  </span>
                </div>
              );
            })}
            {byStatus.get("cancelled") ? (
              <p className="text-muted-foreground pt-2 text-xs">
                {t("funnel.cancelled", {
                  count: count(byStatus.get("cancelled") ?? 0),
                })}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">{t("chart.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="expedionTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => `€${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                    labelStyle={{
                      color: "var(--foreground)",
                      fontWeight: "500",
                      marginBottom: "4px",
                    }}
                    itemStyle={{ color: "var(--primary)" }}
                  />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#expedionTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- The queues: the actual work ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("queues.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={QUEUES[0].key}>
            <TabsList className="mb-4 flex-wrap">
              {QUEUES.map((queue) => (
                <TabsTrigger key={queue.key} value={queue.key}>
                  {t(`queues.${queue.key}`)}
                  {queues[queue.key].length > 0 ? (
                    <Badge variant="secondary" className="ml-2">
                      {queues[queue.key].length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
            {QUEUES.map((queue) => (
              <TabsContent key={queue.key} value={queue.key}>
                <QuoteQueueTable
                  rows={queues[queue.key]}
                  extraColumn={queue.column}
                  // An unread queue arrives empty, and "nothing to price" is
                  // the one thing it must not be allowed to say — that is the
                  // operator closing the tab on work still sitting there.
                  emptyTitle={
                    missing.has("queues")
                      ? t("error")
                      : t(`queues.${queue.key}Empty`)
                  }
                  emptyDescription={
                    missing.has("queues")
                      ? ""
                      : t(`queues.${queue.key}EmptyBody`)
                  }
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* ---- Supply and data health ---- */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="text-muted-foreground h-4 w-4" />
              {t("supply.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              label={t("supply.listings")}
              value={figure(
                "marketplace",
                count(marketplace.expedionListings)
              )}
            />
            <Row
              label={t("supply.offers")}
              value={figure(
                "marketplace",
                count(marketplace.offersOnExpedionJobs)
              )}
            />
            <Row
              label={t("supply.rate")}
              // `escalated` and `assigned` partition the jobs that reached the
              // driver stage — a carrier winning an escalated listing counts
              // once, on the escalated side — so this is the share the pool
              // could not cover, not a proportion of two overlapping sets.
              value={
                quotes.paidValueCents === 0 && quotes.escalated === 0
                  ? "—"
                  : `${Math.round(
                      (quotes.escalated /
                        Math.max(quotes.escalated + quotes.assigned, 1)) *
                        100
                    )} %`
              }
              hint={t("supply.rateHint")}
            />
            <Row
              label={t("supply.insurance")}
              value={figure(
                "quotes",
                `${Math.round(quotes.insuredShare * 100)} %`
              )}
              hint={t("supply.insuranceHint")}
            />
            <Row
              label={t("supply.vehicles")}
              value={figure("marketplace", count(marketplace.activeVehicles))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="text-muted-foreground h-4 w-4" />
              {t("health.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              label={t("health.unowned")}
              value={figure("health", count(health.unowned))}
              hint={t("health.unownedHint")}
            />
            <Row
              label={t("health.missingCoords")}
              value={figure("health", count(health.missingPickupCoords))}
              hint={t("health.missingCoordsHint")}
              tone={health.missingPickupCoords > 0 ? "warning" : undefined}
            />
            <Row
              label={t("health.missingDims")}
              value={figure("health", count(health.missingDimensions))}
              hint={t("health.missingDimsHint")}
            />
            <Row
              label={t("health.confidence")}
              value={
                health.meanExtractionConfidence === null
                  ? "—"
                  : `${Math.round(health.meanExtractionConfidence * 100)} %`
              }
              hint={t("health.confidenceHint", {
                count: figure("health", count(health.extracted)),
              })}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warning";
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-foreground">{label}</div>
        {hint ? (
          <div className="text-muted-foreground text-xs">{hint}</div>
        ) : null}
      </div>
      <div
        className={`shrink-0 font-mono ${
          tone === "warning" ? "text-amber-600 dark:text-amber-500" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
