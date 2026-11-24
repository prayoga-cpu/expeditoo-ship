import { recentRequestsDal } from "@/server/dal/recent-requests.dal";
import {
  RECENT_REQUESTS_LIMIT,
  recentRequestListSchema,
  recentRequestSchema,
  type RecentRequestList,
} from "@/server/dto/recent-requests.dto";
import { toListingView } from "@/server/services/listing-view";

/**
 * « Demandes récentes » on the public landing page
 * (docs/specs/landing_2026_11_spec.md §4).
 *
 * No viewer: nobody is asked who they are, so the answer is the same for
 * everyone and a CDN may keep it. Every row goes through the `public`
 * projection first — the one every anonymous listing read goes through
 * (listing_privacy_spec.md) — and then through the card's own schema, which
 * is narrower still. A row that is not open is dropped here too, whatever the
 * read returned: the landing must never advertise a job that has been
 * awarded, cancelled or drafted.
 */
export const recentRequestsService = {
  async list(now: Date = new Date()): Promise<RecentRequestList> {
    const rows = await recentRequestsDal.latestOpen(RECENT_REQUESTS_LIMIT, now);

    const items = rows
      .filter((row) => row.status === "open")
      .slice(0, RECENT_REQUESTS_LIMIT)
      .map((row) => recentRequestSchema.parse(toListingView({ ...row }, "public")));

    return recentRequestListSchema.parse({ items });
  },
};
