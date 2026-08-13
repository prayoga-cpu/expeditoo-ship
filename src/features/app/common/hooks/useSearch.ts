"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Custom hook for managing search state with optional debouncing
 * Follows DRY principle - used in Messages, Admin, HomePage
 *
 * @param initialValue - Initial search query value
 * @param debounceMs - Optional debounce delay in milliseconds (default: 0 = no debounce)
 * @returns Object containing search query, debounced query, and setter function
 */
export function useSearch(initialValue = "", debounceMs = 0) {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue);

  useEffect(() => {
    if (debounceMs === 0) {
      setDebouncedQuery(searchQuery);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  return {
    searchQuery,
    debouncedQuery,
    setSearchQuery: handleSearchChange,
    clearSearch,
  };
}
