"use client";

import { useQuery } from "@tanstack/react-query";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import { offersApi } from "@/features/app/offers/api/offers.api";
import { deliveriesApi } from "@/features/app/deliveries/api/deliveries.api";
import { useCarrierApplication } from "@/features/app/carrier/hooks/useCarrier";
import { orderRunsByProgress } from "../orderRuns";

/** Shipment states that mean "currently on the road, or about to be". */
const ACTIVE_SHIPMENT_STATUSES = "PENDING,ASSIGNED,PICKED_UP,IN_TRANSIT";

/**
 * Everything the driver home screen shows, as four independent queries.
 *
 * Independent on purpose: a driver with no application yet still gets the job
 * count, and a failure in any one panel leaves the rest of the dashboard
 * standing. There is no combined endpoint to fetch instead — each of these is
 * an existing route already used elsewhere, so the dashboard adds no server
 * surface at all.
 */
export function useDriverDashboard() {
  const application = useCarrierApplication();

  // `limit: 1` because only the total is rendered; the page never lists these.
  const openJobs = useQuery({
    queryKey: ["dashboard", "open-jobs"],
    queryFn: () => listingsApi.browse({ origin: "expedion", limit: 1 }),
  });

  const liveOffers = useQuery({
    queryKey: ["dashboard", "live-offers"],
    queryFn: () => offersApi.mine({ status: "pending", limit: 50 }),
    // A driver without an approved application cannot have offers, and the
    // route answers FORBIDDEN_NOT_CARRIER rather than an empty list.
    enabled: application.data?.status === "approved",
  });

  const activeRuns = useQuery({
    queryKey: ["dashboard", "active-runs"],
    queryFn: () =>
      deliveriesApi.list({ status: ACTIVE_SHIPMENT_STATUSES, limit: 20 }),
  });

  const runs = activeRuns.data?.items ?? [];

  // The API sorts by `desc(createdAt)` — "most recently awarded", not "what am
  // I doing right now". Reorder so the card leads with the job underway.
  const sortedRuns = orderRunsByProgress(runs);

  return {
    application: application.data,
    isApplicationLoading: application.isLoading,
    isApproved: application.data?.status === "approved",

    openJobCount: openJobs.data?.total ?? 0,
    isOpenJobsLoading: openJobs.isLoading,

    liveOfferCount: liveOffers.data?.length ?? 0,
    isOffersLoading: liveOffers.isLoading,

    activeRuns: sortedRuns,
    // The one to lead with: whatever the driver is physically doing now.
    currentRun: sortedRuns[0] ?? null,
    isRunsLoading: activeRuns.isLoading,
  };
}
