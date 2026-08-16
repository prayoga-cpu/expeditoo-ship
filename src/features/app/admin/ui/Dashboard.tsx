"use client";

import {
  Users,
  Truck,
  Package,
  Shield,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { useAdminStats, useAdminActivity } from "../hooks/useAdminAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";

// Helper to format currency
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Helper to format change percentage
function formatChange(percentage: number): string {
  const sign = percentage >= 0 ? "+" : "";
  return `${sign}${percentage.toFixed(1)}%`;
}

// Helper to use in component
// Moved logic inside component to access translations

import { PageLoader } from "@/components/ui/page-loader";

export function Dashboard() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useAdminStats();
  const { data: activity, error: activityError } = useAdminActivity();
  const t = useTranslations("admin.dashboard");

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("time.justNow");
    if (diffMins < 60) return t("time.minAgo", { count: diffMins });
    if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
    return t("time.daysAgo", { count: diffDays });
  };

  // Combine loading states
  const isLoading = statsLoading; // Activity is less critical, but let's just wait for stats which is main

  // Fallback data for chart when loading
  // Normalize data: backend returns cents, chart handles currency units
  const chartData =
    stats?.charts.revenue.map((item) => ({
      ...item,
      total: item.total / 100,
    })) || [];

  return (
    <div className="space-y-6">
      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          {/* Header */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              {t("title")}
            </h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("revenue")}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="h-[60px] flex flex-col justify-center">
                  {statsError ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{t("stats.error")}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {formatCurrency(stats?.kpi.totalRevenue.value || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("stats.fromLastMonth", {
                          value: formatChange(
                            stats?.kpi.totalRevenue.changePercentage || 0
                          ),
                        })}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        *Before Stripe fees
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("users")}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="h-[60px] flex flex-col justify-center">
                  {statsError ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{t("stats.error")}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats?.kpi.activeUsers.value || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("stats.fromLastMonth", {
                          value: formatChange(
                            stats?.kpi.activeUsers.changePercentage || 0
                          ),
                        })}
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("drivers")}
                </CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="h-[60px] flex flex-col justify-center">
                  {statsError ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{t("stats.error")}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats?.kpi.activeDrivers.value || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("stats.fromLastMonth", {
                          value: formatChange(
                            stats?.kpi.activeDrivers.changePercentage || 0
                          ),
                        })}
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("listings")}
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="h-[60px] flex flex-col justify-center">
                  {statsError ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{t("stats.error")}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats?.kpi.pendingDeliveries.value || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("stats.fromLastMonth", {
                          value: formatChange(
                            stats?.kpi.pendingDeliveries.changePercentage || 0
                          ),
                        })}
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
            {/* Revenue Chart */}
            <Card className="col-span-1 md:col-span-4">
              <CardHeader>
                <CardTitle>{t("revenue")}</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[250px] w-full overflow-hidden">
                  {statsError ? (
                    <div className="h-full flex items-center justify-center text-destructive">
                      <AlertCircle className="h-8 w-8 mr-2" />
                      <span>{t("stats.failedChart")}</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient
                            id="colorTotal"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--primary)"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--primary)"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="name"
                          stroke="#888888"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#888888"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `€${value.toFixed(0)}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            borderRadius: "8px",
                            padding: "12px 16px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                          }}
                          labelStyle={{
                            color: "var(--foreground)",
                            fontWeight: "500",
                            marginBottom: "4px",
                          }}
                          itemStyle={{
                            color: "var(--primary)",
                          }}
                          formatter={(value: number) => [
                            // Value is already in units, just format as currency
                            new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                            }).format(value),
                            "Revenue",
                          ]}
                        />
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                          vertical={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorTotal)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="col-span-1 md:col-span-3">
              <CardHeader>
                <CardTitle>{t("stats.recentActivity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] overflow-y-auto pr-2">
                  {activityError ? (
                    <div className="h-full flex items-center justify-center text-destructive">
                      <AlertCircle className="h-6 w-6 mr-2" />
                      <span>{t("stats.failedActivity")}</span>
                    </div>
                  ) : activity && activity.length > 0 ? (
                    <div className="space-y-8">
                      {activity.map((item) => (
                        <div key={item.id} className="flex items-center">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs mr-4">
                            {item.avatar}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {item.user}{" "}
                              <span className="text-muted-foreground font-normal">
                                {item.action}
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.target}
                            </p>
                          </div>
                          <div
                            className="ml-auto font-medium text-xs text-muted-foreground"
                            suppressHydrationWarning
                          >
                            {formatRelativeTime(item.time)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <span>{t("stats.noActivity")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
