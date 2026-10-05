import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DraftForm, NewRequestForm } from "@/features/app/create/ui/RequestForms";

interface PageProps {
  searchParams: Promise<{ draft?: string; step?: string; publish?: string }>;
}

/** The Budget step, where a request is published. */
const BUDGET_STEP = 3;

/**
 * Request transport for an object — or finish one saved earlier
 * (`?draft=<id>`, docs/specs/draft_requests_spec.md §2).
 *
 * The job it creates is `origin: "direct"` — stamped by the service, never
 * sent from here — so the requester owns it and chooses which carrier's offer
 * to accept, rather than an operator awarding it for them. The query is read
 * here, on the server, so no client component needs `useSearchParams` and the
 * Suspense boundary it would demand.
 */
export default async function CreateJobPage({ searchParams }: PageProps) {
  const { draft, step, publish } = await searchParams;
  if (!draft) return <NewRequestForm />;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // The whole way back, « Publier maintenant »'s Budget step included.
    const back = new URLSearchParams({ draft, ...(step && { step }), ...(publish && { publish }) });
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/create?${back}`)}`);
  }

  return (
    <DraftForm
      draftId={draft}
      startStep={step === "budget" ? BUDGET_STEP : 0}
      publishNow={publish === "now"}
    />
  );
}
