import { Suspense } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { MyRequestsScreen } from "@/features/app/listing/ui/MyRequestsScreen";

/**
 * The requests this person has posted, and what became of them.
 *
 * This route redirected to /expedion while Expedion escalation was the only
 * inlet and nobody could post work here. Direct transport requests brought a
 * requester back, and a request you cannot find again is not a request — the
 * draft that /create saves lands here too.
 *
 * `Suspense` is load-bearing: the screen holds its tab in the URL and so reads
 * `useSearchParams`, which builds without one and then fails `next build`.
 */
export default function MyRequestsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <MyRequestsScreen />
    </Suspense>
  );
}
