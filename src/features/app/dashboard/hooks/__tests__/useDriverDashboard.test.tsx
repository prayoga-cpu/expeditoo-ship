import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/fetcher";

/** 2.77.1: an approved application is not the carrier role. */
const state = vi.hoisted(() => ({ roles: ["shipper"] as string[], mineError: null as unknown }));
const mine = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { roles: state.roles } }) }));
vi.mock("@/features/app/offers/api/offers.api", () => ({ offersApi: { mine } }));
vi.mock("@/features/app/listing/api/listings.api", () => ({
  listingsApi: { browse: vi.fn().mockResolvedValue({ total: 2 }), mine: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/features/app/deliveries/api/deliveries.api", () => ({
  deliveriesApi: { list: vi.fn().mockResolvedValue({ items: [] }) },
}));
vi.mock("@/features/app/carrier/hooks/useCarrier", () => ({
  useCarrierApplication: () => ({ data: { status: "approved" }, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/features/app/profile/hooks/useSavedCards", () => ({
  useSavedCards: () => ({ data: [], isLoading: false, isError: false }),
}));

import { useDriverDashboard } from "../useDriverDashboard";

const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  mine.mockReset();
  mine.mockResolvedValue([{ id: "o1" }]);
  state.roles = ["shipper"];
});

describe("useDriverDashboard — offers", () => {
  it("never asks for offers without the carrier role", async () => {
    const { result } = renderHook(() => useDriverDashboard(), { wrapper: wrap });
    await waitFor(() => expect(result.current.isOpenJobsLoading).toBe(false));

    expect(mine).not.toHaveBeenCalled();
    expect(result.current.loadFailed).toBe(false);
  });

  it("asks for them with it", async () => {
    state.roles = ["shipper", "carrier"];
    const { result } = renderHook(() => useDriverDashboard(), { wrapper: wrap });

    await waitFor(() => expect(result.current.liveOfferCount).toBe(1));
  });

  it("does not call a refusal a failed load", async () => {
    state.roles = ["carrier"];
    mine.mockRejectedValue(new ApiError("FORBIDDEN_NOT_CARRIER", "no", 403));
    const { result } = renderHook(() => useDriverDashboard(), { wrapper: wrap });

    await waitFor(() => expect(mine).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isOffersLoading).toBe(false));
    expect(result.current.loadFailed).toBe(false);
  });

  it("still reports a server failure", async () => {
    state.roles = ["carrier"];
    mine.mockRejectedValue(new ApiError("INTERNAL", "boom", 500));
    const { result } = renderHook(() => useDriverDashboard(), { wrapper: wrap });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
  });
});
