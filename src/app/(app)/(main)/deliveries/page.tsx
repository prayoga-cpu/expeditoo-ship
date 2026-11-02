"use client";

import { Deliveries } from "@/features/app/deliveries/ui";
import { useDeliveries } from "@/features/app/deliveries/hooks";

/**
 * Deliveries page - orchestration only. Data and mapping live in the hook,
 * presentation in the feature UI.
 */
export default function DeliveriesPage() {
  const { activeTab, setActiveTab, deliveries, isLoading, error, refetch } =
    useDeliveries();

  return (
    <Deliveries
      activeTab={activeTab}
      deliveries={deliveries}
      isLoading={isLoading}
      error={error}
      onRetry={() => void refetch()}
      onTabChange={setActiveTab}
    />
  );
}
