import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DraftForm, NewRequestForm } from "@/features/app/create/ui/RequestForms";

interface PageProps {
  searchParams: Promise<{ draft?: string; step?: string; publish?: string; type?: string }>;
}

/** The Budget step, where a request is published. */
const BUDGET_STEP = 3;

/**
 * Request transport for an object — or finish one saved earlier
 * (`?draft=<id>`, docs/specs/draft_requests_spec.md §2). `?type=moving` opens
 * it as a move — the link to share for « devis déménagement »
 * (client_feedback_2026_10_31_spec.md §2.2).
 *
 * The job it creates is `origin: "direct"` — stamped by the service, never
 * sent from here — so the requester owns it and chooses which carrier's offer
 * to accept, rather than an operator awarding it for them. The query is read
 * here, on the server, so no client component needs `useSearchParams` and the
 * Suspense boundary it would demand. Nobody reaches the form without a
 * session.
 */
export default async function CreateJobPage({ searchParams }: PageProps) {
  const { draft, step, publish, type } = await searchParams;

  // `/create` is not in the proxy's protected list, and a request can only be
  // posted with a session (`POST /api/listings`). Without this a signed-out
  // visitor was handed the whole form — five steps, photos included — and
  // lost it to a 401 on « Publier ». The way back is the whole link:
  // `?type=moving`, and « Publier maintenant »'s Budget step on a draft.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const back = new URLSearchParams({
      ...(draft && { draft }),
      ...(step && { step }),
      ...(publish && { publish }),
      ...(type && { type }),
    }).toString();
    const target = back ? `/create?${back}` : "/create";
    redirect(`/signin?callbackUrl=${encodeURIComponent(target)}`);
  }

  if (!draft) return <NewRequestForm kind={type === "moving" ? "moving" : "items"} />;

  return (
    <DraftForm
      draftId={draft}
      startStep={step === "budget" ? BUDGET_STEP : 0}
      publishNow={publish === "now"}
    />
  );
}
