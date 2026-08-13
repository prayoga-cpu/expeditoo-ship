"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useEarnings,
  useEarningsSummary,
  useStripeDashboard,
  type EarningItem,
} from "../hooks/useEarnings";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowLeft,
  TrendingUp,
  Truck,
  Tag,
  ExternalLink,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { PageLoader, InlineLoader } from "@/components/ui/page-loader";
import { LottieLoader } from "@/components/ui/lottie-loader";
import type { EarningSourceType } from "@/db/schema/earnings";
import { cn } from "@/lib/utils";

const sourceConfig = {
  sale: {
    label: "Sale",
    icon: Tag,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  delivery: {
    label: "Delivery",
    icon: Truck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  app_fee: {
    label: "Platform Fee",
    icon: TrendingUp,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
};

function EarningRow({ earning }: { earning: EarningItem }) {
  const config = sourceConfig[earning.source];
  const Icon = config.icon;
  const date = new Date(earning.createdAt);

  return (
    <div className="flex items-center gap-4 py-4 border-b border-border/50 last:border-0">
      <div className={cn("p-2.5 rounded-full", config.bgColor)}>
        <Icon className={cn("w-5 h-5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {earning.order?.listing?.title || earning.description || config.label}
        </p>
        <p className="text-sm text-muted-foreground">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-green-500">
          +{formatCurrency(earning.amount)}
        </p>
        <Badge variant="outline" className="text-xs">
          {config.label}
        </Badge>
      </div>
    </div>
  );
}

export function Earnings() {
  const [activeSource, setActiveSource] = useState<"all" | EarningSourceType>(
    "all"
  );

  const { data: summaryRes, isLoading: isSummaryLoading } =
    useEarningsSummary();
  const { data: earningsRes, isLoading: isEarningsLoading } = useEarnings({
    limit: 50,
    source: activeSource === "all" ? undefined : activeSource,
  });
  const { openDashboard } = useStripeDashboard();
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);

  const handleOpenDashboard = async () => {
    setIsOpeningDashboard(true);
    try {
      await openDashboard();
    } catch (error) {
      // Error already logged in hook
    } finally {
      setIsOpeningDashboard(false);
    }
  };

  if (isSummaryLoading) {
    return <PageLoader variant="padded" />;
  }

  const summary = summaryRes?.data;
  const earnings = earningsRes?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <Link href="/profile">
              <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
              <p className="text-muted-foreground mt-1">
                Track your income from sales and deliveries
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleOpenDashboard}
            disabled={isOpeningDashboard}
            className="w-full sm:w-auto"
          >
            {isOpeningDashboard ? (
              <LottieLoader width={20} height={20} className="mr-2" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            Payout Settings
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Total */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(summary?.total.amount || 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {summary?.total.count || 0} transactions
            </p>
          </CardContent>
        </Card>

        {/* From Sales */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-500" />
              From Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.sale.amount || 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {summary?.sale.count || 0} sales
            </p>
          </CardContent>
        </Card>

        {/* From Deliveries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-green-500" />
              From Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.delivery.amount || 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {summary?.delivery.count || 0} deliveries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <Tabs
              value={activeSource}
              onValueChange={(v) =>
                setActiveSource(v as "all" | EarningSourceType)
              }
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="sale">Sales</TabsTrigger>
                <TabsTrigger value="delivery">Deliveries</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isEarningsLoading ? (
            <InlineLoader size="md" className="py-12" />
          ) : earnings.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No earnings yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start selling or delivering to see your earnings here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {earnings.map((earning) => (
                <EarningRow key={earning.id} earning={earning} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Note */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Automatic Payouts:</strong> Your earnings are automatically
          transferred to your bank account based on your payout schedule. Click
          &quot;Payout Settings&quot; to manage your bank details and schedule.
        </p>
      </div>
    </div>
  );
}
