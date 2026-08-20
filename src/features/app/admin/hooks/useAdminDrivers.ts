import { useState, useCallback, useEffect } from "react";
import type { User } from "../types";
import { mapApiUser } from "../lib/map-api-user";

export function useAdminDrivers() {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        role: "driver",
        pageSize: "100", // TODO: Implement proper pagination
        search: searchQuery
      });

      const response = await fetch(`/api/admin/users?${queryParams}`);
      
      if (response.ok) {
        const data = await response.json();

        const mappedUsers: User[] = (data.data?.users || []).map(mapApiUser);

        setDrivers(mappedUsers);
      }
    } catch (error) {
      console.error("Failed to fetch drivers", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleRemoveDriver = useCallback(async (user: User) => {
    try {
      const response = await fetch("/api/user/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role: "shipper",
          replace: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to remove driver role");
      }

      // Refetch specific drivers list
      fetchDrivers();
    } catch (error) {
      console.error("Failed to remove driver role:", error);
    }
  }, [fetchDrivers]);

  useEffect(() => {
    // Debounce search could be added here

    const timer = setTimeout(() => {
      fetchDrivers();
    }, searchQuery ? 500 : 0);

    return () => clearTimeout(timer);
  }, [fetchDrivers, searchQuery]);

  return { 
    drivers, 
    isLoading, 
    searchQuery, 
    setSearchQuery, 
    refetchDrivers: fetchDrivers,
    handleRemoveDriver
  };
}
