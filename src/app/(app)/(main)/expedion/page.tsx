"use client";

import { Suspense } from "react";
import { JobBoard } from "@/features/app/home/ui";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * The job board — every open job a driver can bid on, whichever inlet it came
 * from.
 *
 * It was pinned to `origin: "expedion"` while escalated quotes were the only
 * inlet. Direct transport requests are an inlet again, and a request no driver
 * can see is not a request, so the pin is gone. `JobBoard` still takes an
 * `origin` prop, so narrowing the board to one inlet stays a one-word change if
 * the two ever need separating again.
 *
 * The route keeps its name: it is bookmarked, sits in the sidebar and the
 * mobile bar, and is linked from outside this codebase.
 */
export default function ExpedionJobsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <JobBoard />
    </Suspense>
  );
}
