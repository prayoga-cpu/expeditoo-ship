"use client";

import { JobForm } from "@/features/app/create/ui";
import { useJobForm } from "@/features/app/create/hooks";

/**
 * Request transport for an object.
 *
 * The inlet a person uses when they have something to move and no Expedion
 * quote behind it. The job it creates is `origin: "direct"` — stamped by the
 * service, never sent from here — so the requester owns it and chooses which
 * carrier's offer to accept, rather than an operator awarding it for them.
 */
export default function CreateJobPage() {
  const jobForm = useJobForm();
  return <JobForm {...jobForm} />;
}
