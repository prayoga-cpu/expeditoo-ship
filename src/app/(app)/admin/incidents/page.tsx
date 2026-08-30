import { IncidentQueue } from "@/features/app/incidents/ui";

/**
 * What went wrong on live runs, and the two answers.
 * Access is enforced in the service (docs/rules.md §8), not here.
 */
export default function AdminIncidentsPage() {
  return <IncidentQueue />;
}
