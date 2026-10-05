"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { ApiError } from "@/lib/fetcher";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import { jobKeys } from "@/features/app/listing/hooks/useJobDetail";
import type { DraftJob } from "@/features/app/listing/types";
import { useJobForm } from "../hooks/useJobForm";
import { JobForm } from "./JobForm";

/** A new request, from a blank form. */
export function NewRequestForm() {
  return <JobForm {...useJobForm()} />;
}

interface DraftFormProps {
  draftId: string;
  startStep: number;
  publishNow: boolean;
}

/** Not there for this person: deleted, never theirs, or not theirs to see. */
const isGone = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 403);

/**
 * A request that has not gone live, loaded to finish it
 * (docs/specs/draft_requests_spec.md §2). Read fresh, never from the cache:
 * what is on the form is what the PUT will write over.
 *
 * Read **once**. The form is seeded from the first copy and never reads a
 * later one, so a refetch could only take the form away: a reconnect that
 * failed swapped it for « Demande introuvable », unsaved edits and all. Offline,
 * the read waits (`isPending`) rather than failing.
 */
export function DraftForm({ draftId, startStep, publishNow }: DraftFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["draft", draftId],
    queryFn: () => listingsApi.getDraft(draftId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  // Live already — published elsewhere, or by the scheduler: its own page.
  const live = error instanceof ApiError && error.code === "LISTING_NOT_DRAFT";
  const gone = isGone(error);

  useEffect(() => {
    if (!live && !gone) return;
    // A copy read under a minute ago would still show it as it was — on its
    // page, and in the list « Demande introuvable » links back to.
    queryClient.invalidateQueries({ queryKey: jobKeys.detail(draftId) });
    queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
    if (live) router.replace(`/listing/${draftId}`);
  }, [live, gone, draftId, queryClient, router]);

  if (data) {
    return (
      <ResumedForm key={data.id} draft={data} startStep={startStep} publishNow={publishNow} />
    );
  }
  if (isPending || isFetching || live) return <PageLoader />;
  if (gone) return <DraftNotFound />;
  return <DraftLoadFailed onRetry={() => void refetch()} />;
}

function ResumedForm(props: { draft: DraftJob; startStep: number; publishNow: boolean }) {
  return <JobForm {...useJobForm(props)} />;
}

function DraftNotFound() {
  const t = useTranslations("create.resume");
  return (
    <CenteredEmptyState
      variant="page"
      icon={SearchX}
      title={t("notFound")}
      description={t("notFoundDesc")}
    >
      <Button asChild variant="outline">
        <Link href="/listings/me">{t("back")}</Link>
      </Button>
    </CenteredEmptyState>
  );
}

/** Any other failure — the network, the server: said as one, with a retry. */
function DraftLoadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("create.resume");
  const tLoad = useTranslations("myJobs.detail.loadError");
  return (
    <CenteredEmptyState
      variant="page"
      icon={AlertTriangle}
      title={tLoad("title")}
      description={tLoad("description")}
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRetry}>
          {tLoad("retry")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/listings/me">{t("back")}</Link>
        </Button>
      </div>
    </CenteredEmptyState>
  );
}
