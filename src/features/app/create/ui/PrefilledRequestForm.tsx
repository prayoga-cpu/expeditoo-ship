"use client";

import type { JobKind } from "@/lib/moving";
import type { RequestPrefill } from "../prefill";
import { useJobForm } from "../hooks/useJobForm";
import { JobForm } from "./JobForm";

/**
 * A new request that starts from what the landing page's search card carried
 * (docs/specs/landing_2026_11_spec.md §5) — `NewRequestForm` with starting
 * values. Never a draft: `/create?draft=` does not read the prefill at all.
 */
export function PrefilledRequestForm({
  kind,
  prefill,
}: {
  kind?: JobKind;
  prefill: RequestPrefill;
}) {
  return <JobForm {...useJobForm({ kind, prefill })} />;
}
