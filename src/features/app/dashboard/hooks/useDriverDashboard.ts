"use client";

import { useQuery } from "@tanstack/react-query";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import { offersApi } from "@/features/app/offers/api/offers.api";
import { deliveriesApi } from "@/features/app/deliveries/api/deliveries.api";
import { useCarrierApplication } from "@/features/app/carrier/hooks/useCarrier";
import { useAuth } from "@/lib/auth-context";
import { isRefusal } from "@/lib/fetcher";
import { useMyRequests } from "@/features/app/listing/hooks/useMyRequests";
import { useSavedCards } from "@/features/app/profile/hooks/useSavedCards";
import type { ListingStatus } from "@/features/app/listing/types";
import { orderRunsByProgress } from "../orderRuns";
import { showsDriverInvite } from "../driverInvite";

/** Shipment states that mean "currently on the road, or about to be". */
const ACTIVE_SHIPMENT_STATUSES = "PENDING,ASSIGNED,PICKED_UP,IN_TRANSIT";

/** A requester still owes a card once one of these is open with none on file. */
const NEEDS_CARD_STATUSES: ListingStatus[] = ["open", "awarded"];

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
  // The offers route answers only to the carrier role, which an approved
  // application does not guarantee (it can be revoked afterwards): asking
  // without it is a 403 that read as « did not load » (2.77.1).
  const { user } = useAuth();
  const isCarrier = user?.roles?.includes("carrier") ?? false;

  // `limit: 1` because only the total is rendered; the page never lists these.
  // Unpinned from `origin: "expedion"` so the count matches what the board
  // actually shows — a driver reading "3 open jobs" and finding five is worse
  // than either number on its own.
  const openJobs = useQuery({
    queryKey: ["dashboard", "open-jobs"],
    queryFn: () => listingsApi.browse({ limit: 1 }),
  });

  const liveOffers = useQuery({
    queryKey: ["dashboard", "live-offers"],
    queryFn: () => offersApi.mine({ status: "pending", limit: 50 }),
    // A driver without an approved application cannot have offers, and the
    // route answers FORBIDDEN_NOT_CARRIER rather than an empty list.
    enabled: application.data?.status === "approved" && isCarrier,
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

  // Whether the requester still needs to connect a card. Same query
  // `/listings/me` and `useMyRequestStatus` use (same cache key), so this adds
  // no extra fetch beyond the one `MyRequestStatusCard` already causes.
  const myRequests = useMyRequests();
  const savedCards = useSavedCards();

  const isCardNudgeLoading = myRequests.isLoading || savedCards.isLoading;
  const needsCardNudge =
    !isCardNudgeLoading &&
    (savedCards.data?.length ?? 0) === 0 &&
    (myRequests.data ?? []).some(
      (job) => job.origin === "direct" && NEEDS_CARD_STATUSES.includes(job.status)
    );

  // A failed fetch counts as "no requests": the card is then shown, as it was
  // before it learned to step aside for requesters (request_summary_spec.md §1).
  const showDriverInvite = showsDriverInvite({
    hasApplication: Boolean(application.data),
    requestCount: myRequests.isError
      ? 0
      : (myRequests.data?.length ?? null),
  });

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

    needsCardNudge,
    showDriverInvite,

    // A count that failed would otherwise read « 0 » — a fact nobody stated —
    // so the page says a read failed and offers it again (§4).
    // A refusal is not a failed read: the banner above already explains it.
    loadFailed: [application, openJobs, liveOffers, activeRuns, myRequests].some(
      (query) => query.isError && !isRefusal(query.error)
    ),
    retry: () => {
      for (const query of [application, openJobs, liveOffers, activeRuns, myRequests]) {
        if (query.isError && !isRefusal(query.error)) void query.refetch();
      }
    },
  };
}
