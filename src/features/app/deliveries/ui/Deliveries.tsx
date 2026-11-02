"use client";

import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { useTranslations } from "next-intl";
import { DeliveryCard } from "./DeliveryCard";
import type { DeliverySummaryView, DeliveryTab } from "../types";

interface DeliveriesProps {
  activeTab: DeliveryTab;
  deliveries: DeliverySummaryView[];
  onTabChange: (tab: DeliveryTab) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry: () => void;
}

/** The tracking list, split into in-flight and settled shipments. */
export function Deliveries({
  activeTab,
  deliveries,
  onTabChange,
  isLoading = false,
  error = null,
  onRetry,
}: DeliveriesProps) {
  const t = useTranslations("deliveries");
  const next = useTranslations("common.nextSteps");

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as DeliveryTab)}
        className="mt-4 flex flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="active">{t("tabs.active")}</TabsTrigger>
          <TabsTrigger value="past">{t("tabs.past")}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex flex-1 flex-col gap-3 pt-4">
          {isLoading ? (
            <PageLoader />
          ) : error ? (
            <LoadErrorState
              variant="page"
              title={t("errors.loadFailed")}
              description={error}
              onRetry={onRetry}
            />
          ) : deliveries.length > 0 ? (
            deliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} />
            ))
          ) : (
            <CenteredEmptyState
              variant="page"
              icon={PackageOpen}
              title={
                activeTab === "active" ? t("tabs.noActive") : t("tabs.noPast")
              }
              description={
                activeTab === "active"
                  ? t("tabs.noActiveDesc")
                  : t("tabs.noPastDesc")
              }
            >
              {/* A delivery starts as a request (no_dead_ends_spec.md §5). */}
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/create">{next("newRequest")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/listings/me">{next("myRequests")}</Link>
                </Button>
              </div>
            </CenteredEmptyState>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
