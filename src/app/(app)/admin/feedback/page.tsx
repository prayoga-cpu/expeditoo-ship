import { FeedbackConsole } from "@/features/app/feedback/ui";

/**
 * What people are telling us, and what we did about it.
 * Access is enforced in the service (docs/rules.md §8), not here.
 */
export default function AdminFeedbackPage() {
  return <FeedbackConsole />;
}
