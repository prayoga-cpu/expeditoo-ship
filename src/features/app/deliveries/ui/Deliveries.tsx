"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Package, PackageOpen } from "lucide-react";
import { DeliveryCard } from "./DeliveryCard";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import type { Delivery, DeliveryTab } from "../types";
import { useTranslations } from "next-intl";

/**
 * Pure UI component for displaying deliveries list
 * Follows Single Responsibility Principle - only handles presentation
 * Business logic handled by useDeliveries hook in page
 *
 * @param activeTab - Currently active tab
 * @param deliveries - Array of deliveries to display
 * @param onTabChange - Callback when tab changes
 */
interface DeliveriesProps {
  activeTab: DeliveryTab;
  deliveries: Delivery[];
  onTabChange: (tab: DeliveryTab) => void;
  isLoading?: boolean;
}

export function Deliveries({
  activeTab,
  deliveries,
  onTabChange,
  isLoading = false,
}: DeliveriesProps) {
  const t = useTranslations("deliveries");

  if (isLoading) {
    return <PageLoader variant="default" />;
  }

  return (
    <div className="  mx-auto w-full h-full flex flex-col">
      <div className="hidden md:block py-2 border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 z-10">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t("title")}
          </h1>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={onTabChange as (value: string) => void}
        className="flex-1 flex flex-col"
      >
        <div className="py-2 border-b border-border bg-background/50 backdrop-blur supports-backdrop-filter:bg-background/30">
          <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-2 border-0">
            <TabsTrigger
              value="incoming"
              className="px-4 py-2.5 rounded-lg font-medium text-sm text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-primary/8 border border-transparent data-[state=active]:border-primary/20 transition-all duration-200 hover:bg-muted/50"
            >
              {t("tabs.active")}
            </TabsTrigger>
            <TabsTrigger
              value="outgoing"
              className="px-4 py-2.5 rounded-lg font-medium text-sm text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-primary/8 border border-transparent data-[state=active]:border-primary/20 transition-all duration-200 hover:bg-muted/50"
            >
              {t("tabs.completed")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 flex flex-col">
            <TabsContent value={activeTab} className="flex-1 flex flex-col gap-4">
              {deliveries.length > 0 ? (
                deliveries.map((delivery, index) => (
                  <DeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    index={index}
                  />
                ))
              ) : (

                <CenteredEmptyState
                  variant="page"
                  icon={PackageOpen}
                  title={
                    activeTab === "incoming"
                      ? t("tabs.noIncoming")
                      : t("tabs.noOutgoing")
                  }
                  description={
                    activeTab === "incoming"
                      ? t("tabs.noIncomingDesc")
                      : t("tabs.noOutgoingDesc")
                  }
                  className="animate-in fade-in-50 duration-500"
                />
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
