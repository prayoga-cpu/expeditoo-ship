"use client";

import { Suspense } from "react";
import { DriverDashboard } from "@/features/app/dashboard/ui";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Home is the driver's dashboard, not a job board.
 *
 * The board that used to live here moved to /expedion when Expedion escalation
 * became the only inlet. A driver landing on the app needs their standing first
 * — approved or not, what they are carrying, what is waiting — and the list of
 * work one tap away.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DriverDashboard />
    </Suspense>
  );
}
