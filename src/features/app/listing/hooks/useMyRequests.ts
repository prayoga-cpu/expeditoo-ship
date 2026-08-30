"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listingsApi } from "../api/listings.api";
import type { Job, JobDelivery, ListingStatus } from "../types";

export const myRequestKeys = {
  list: (status?: ListingStatus) => ["my-jobs", status ?? "all"] as const,
};

/** The caller's own requests, optionally narrowed to one status. */
export function useMyRequests(status?: ListingStatus) {
  return useQuery({
    queryKey: myRequestKeys.list(status),
    queryFn: () => listingsApi.mine(status),
  });
}

/** A delivered request, with the transporter who delivered it. */
export interface DeliveredRequest {
  job: Job;
  delivery: JobDelivery;
}

/**
 * The history tab: the requests that were actually delivered, newest first.
 *
 * It asks for the list **unfiltered** on purpose, so the other tab's status
 * filter can never hide a delivery. React Query serves both tabs from the one
 * cache entry when that filter sits at "all".
 */
export function useDeliveryHistory() {
  const query = useMyRequests();

  const deliveries = useMemo<DeliveredRequest[]>(() => {
    const rows = (query.data ?? [])
      .filter((job): job is Job & { delivery: JobDelivery } =>
        Boolean(job.delivery)
      )
      .map((job) => ({ job, delivery: job.delivery }));

    // Newest delivery first. An undated row sorts to the bottom on 0 rather
    // than through `new Date(null)`, whose NaN would make the comparator
    // return NaN and leave the whole order unspecified.
    return rows.sort((a, b) => stamp(b.delivery) - stamp(a.delivery));
  }, [query.data]);

  return {
    deliveries,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

const stamp = (delivery: JobDelivery) =>
  delivery.deliveredAt ? new Date(delivery.deliveredAt).getTime() : 0;
