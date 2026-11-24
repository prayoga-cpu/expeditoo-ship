import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DraftForm, NewRequestForm } from "@/features/app/create/ui/RequestForms";
import { PrefilledRequestForm } from "@/features/app/create/ui/PrefilledRequestForm";
import { parseRequestPrefill, prefillQuery } from "@/features/app/create/prefill";

type QueryValue = string | string[] | undefined;

interface PageProps {
  searchParams: Promise<{
    draft?: string;
    step?: string;
    publish?: string;
    type?: string;
    title?: QueryValue;
    from?: QueryValue;
    to?: QueryValue;
    date?: QueryValue;
  }>;
}

/** The Budget step, where a request is published. */
const BUDGET_STEP = 3;

/**
 * Request transport for an object — or finish one saved earlier
 * (`?draft=<id>`, docs/specs/draft_requests_spec.md §2). `?type=moving` opens
 * it as a move — the link to share for « devis déménagement »
 * (client_feedback_2026_10_31_spec.md §2.2). `?title=&from=&to=&date=` is
 * what the landing page's search card carries: starting values for a new
 * request, checked once here and never applied to a draft
 * (landing_2026_11_spec.md §5).
 *
 * The job it creates is `origin: "direct"` — stamped by the service, never
 * sent from here — so the requester owns it and chooses which carrier's offer
 * to accept, rather than an operator awarding it for them. The query is read
 * here, on the server, so no client component needs `useSearchParams` and the
 * Suspense boundary it would demand. Nobody reaches the form without a
 * session.
 */
export default async function CreateJobPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const { draft, step, publish, type } = query;
  // Read per request, on the server: which days are still ahead is a question
  // for the clock, and this page is never prerendered (it reads the session).
  const prefill = draft ? null : parseRequestPrefill(query, new Date());

  // `/create` is not in the proxy's protected list, and a request can only be
  // posted with a session (`POST /api/listings`). Without this a signed-out
  // visitor was handed the whole form — five steps, photos included — and
  // lost it to a 401 on « Publier ». The way back is the whole link:
  // `?type=moving`, the landing card's checked values, and « Publier
  // maintenant »'s Budget step on a draft.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const back = new URLSearchParams({
      ...(draft && { draft }),
      ...(step && { step }),
      ...(publish && { publish }),
      ...(type && { type }),
      ...prefillQuery(prefill),
    }).toString();
    const target = back ? `/create?${back}` : "/create";
    redirect(`/signin?callbackUrl=${encodeURIComponent(target)}`);
  }

  const kind = type === "moving" ? "moving" : "items";
  if (!draft) {
    return prefill ? (
      <PrefilledRequestForm kind={kind} prefill={prefill} />
    ) : (
      <NewRequestForm kind={kind} />
    );
  }

  return (
    <DraftForm
      draftId={draft}
      startStep={step === "budget" ? BUDGET_STEP : 0}
      publishNow={publish === "now"}
    />
  );
}
