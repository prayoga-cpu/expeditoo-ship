"use client";

import { Deliveries } from "@/features/app/deliveries/ui";
import { useDeliveries } from "@/features/app/deliveries/hooks";

/**
 * Deliveries page - Orchestration layer
 * Follows SOLID principle - uses hooks for business logic, passes data to UI components
 */
export default function DeliveriesPage() {
  const { activeTab, setActiveTab, deliveries, isLoading } = useDeliveries();

  return (
    <Deliveries
      activeTab={activeTab}
      deliveries={deliveries}
      isLoading={isLoading}
      onTabChange={setActiveTab}
    />
  );
}
