import { useState, useCallback } from "react";

/**
 * Custom hook for managing tab state
 * Follows DRY principle - used across Deliveries, Messages, Notifications, Reviews
 *
 * @param defaultTab - Initial tab value
 * @returns Object containing current tab and setter function
 */
export function useTabState<T extends string = string>(defaultTab: T) {
  const [activeTab, setActiveTab] = useState<T>(defaultTab);

  const handleTabChange = useCallback((tab: T) => {
    setActiveTab(tab);
  }, []);

  return {
    activeTab,
    setActiveTab: handleTabChange,
  };
}
