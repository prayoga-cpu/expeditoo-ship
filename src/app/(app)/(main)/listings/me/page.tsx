import { MyJobs } from "./MyJobs";

/**
 * The requests this person has posted, in any state.
 *
 * This route redirected to /expedion while Expedion escalation was the only
 * inlet and nobody could post work here. Direct transport requests brought a
 * requester back, and a request you cannot find again is not a request — the
 * draft that /create saves lands here too.
 */
export default function MyJobsPage() {
  return <MyJobs />;
}
