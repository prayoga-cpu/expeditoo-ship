"use client";

import { useQuery } from "@tanstack/react-query";
import { api, toQuery } from "@/lib/fetcher";

/**
 * Answer of GET /api/reviews/can-review. When eligible it also names who the
 * review would target, so the UI never has to re-derive the counterparty.
 */
export type CanReviewResult =
  | { canReview: true; role: "shipper" | "carrier"; targetUserId: string }
  | { canReview: false; reason: string };

/**
 * Whether the viewer may review the counterparty of this shipment.
 * Only meaningful once the shipment is DELIVERED - gate the call on that.
 */
export function useCanReview(shipmentId: string, enabled = true) {
  return useQuery({
    queryKey: ["can-review", shipmentId],
    queryFn: () =>
      api.get<CanReviewResult>(`/api/reviews/can-review${toQuery({ shipmentId })}`),
    enabled: Boolean(shipmentId) && enabled,
  });
}
