"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface AdminDateRangeValue {
  /** Local-day ISO string (YYYY-MM-DD), or "" for no lower bound. */
  from: string;
  /** Local-day ISO string (YYYY-MM-DD), or "" for no upper bound. */
  to: string;
  setRange: (from: string, to: string) => void;
}

const AdminDateRangeContext = createContext<AdminDateRangeValue | null>(null);

/**
 * One date range for the whole admin panel, owned by `AdminLayout`'s header
 * so it survives navigating between pages — the same way a dashboard's
 * global time-range picker works. Every admin table opts in by passing
 * `dateFilterKey` to `DataTable`, which reads this instead of running its
 * own local filter state.
 */
export function AdminDateRangeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const value = useMemo<AdminDateRangeValue>(
    () => ({
      from,
      to,
      setRange: (nextFrom, nextTo) => {
        setFrom(nextFrom);
        setTo(nextTo);
      },
    }),
    [from, to]
  );

  return (
    <AdminDateRangeContext.Provider value={value}>
      {children}
    </AdminDateRangeContext.Provider>
  );
}

export function useAdminDateRange(): AdminDateRangeValue {
  const ctx = useContext(AdminDateRangeContext);
  if (!ctx) {
    throw new Error(
      "useAdminDateRange must be used within AdminDateRangeProvider"
    );
  }
  return ctx;
}
