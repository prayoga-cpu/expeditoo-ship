"use client";

import { Suspense } from "react";
import { JobBoard } from "@/features/app/home/ui";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * The job board.
 *
 * Pinned to `origin: "expedion"` because escalated Expedion quotes are the only
 * inlet now that shippers no longer post directly. Legacy `direct` listings —
 * seeded, or left from the shipper-posting era — are deliberately excluded
 * rather than deleted, so old data stays readable without cluttering the board.
 */
export default function ExpedionJobsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <JobBoard origin="expedion" />
    </Suspense>
  );
}
