"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, SearchX } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { formatCurrency } from "@/lib/currency";
import { useJobDetail } from "@/features/app/listing/hooks/useJobDetail";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import { RequestSummary } from "@/features/app/listing/ui/RequestSummary";
import type { ListingStatus } from "@/features/app/listing/types";
import { MOMENT_FORMAT } from "./PublicationNotice";

/** The two states a request is in the moment it has been posted. */
const JUST_POSTED: readonly ListingStatus[] = ["open", "scheduled"];

interface RequestPostedScreenProps {
  listingId: string;
  viewerId: string;
}

/**
 * The page after « Publier la demande »: thanks, the reference people will
 * quote, the request read back, and what happens next
 * (request_posted_page_spec.md §3).
 *
 * It states only what the platform has done: the bidding deadline is the row's
 * own `expires_at`, the bell is what `submitOffer` raises for every offer, and
 * nothing is taken until an offer is accepted. It does not say an email was
 * sent — production's sandbox sender reaches nobody but the account owner.
 *
 * Revisited later, or opened by someone else, it is not a thank-you any more,
 * so it hands over to the request's own page.
 */
export function RequestPostedScreen({ listingId, viewerId }: RequestPostedScreenProps) {
  const t = useTranslations("create.success");
  const format = useFormatter();
  const router = useRouter();
  const { data: job, isLoading, isError } = useJobDetail(listingId);
  const heading = useRef<HTMLHeadingElement>(null);

  const belongsHere =
    !job || (job.shipperId === viewerId && JUST_POSTED.includes(job.status));
  const ready = Boolean(job) && belongsHere;

  useEffect(() => {
    if (!belongsHere) router.replace(`/listing/${listingId}`);
  }, [belongsHere, listingId, router]);

  // The button that was pressed is gone, and every app page shares one
  // document title, so nothing would tell a screen reader the request went
  // out — the toast that used to say it is gone too. Focus says it.
  useEffect(() => {
    if (ready) heading.current?.focus();
  }, [ready]);

  if (isError) {
    return (
      <CenteredEmptyState
        variant="page"
        icon={SearchX}
        title={t("notFound.title")}
        description={t("notFound.description")}
      >
        <Button asChild>
          <Link href="/listings/me">{t("actions.myRequests")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  if (isLoading || !job || !belongsHere) return <PageLoader />;

  const moment = (iso: string) => format.dateTime(new Date(iso), MOMENT_FORMAT);
  const scheduled = job.status === "scheduled";

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden />
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-4 text-2xl font-semibold tracking-tight outline-none"
          >
            {t(scheduled ? "scheduled.title" : "open.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {scheduled
              ? job.scheduledPublishAt &&
                t("scheduled.lead", { date: moment(job.scheduledPublishAt) })
              : t("open.lead")}
          </p>
          <div className="mt-3">
            <ListingReference reference={job.reference} copyable />
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-lg border bg-muted/40 p-4">
          <RequestSummary job={job} titleAs="h2" />
          <p className="text-sm">
            {t("budget", { amount: formatCurrency(job.budgetCents) })}
          </p>
        </div>

        <section className="mt-6">
          <h2 className="font-semibold">{t("next.title")}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t("next.offers", { date: moment(job.expiresAt) })}</li>
            <li>{t("next.notify")}</li>
            <li>{t("next.choose")}</li>
            <li>{t("next.pay")}</li>
          </ol>
        </section>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button asChild>
            <Link href={`/listing/${job.id}`}>{t("actions.view")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/listings/me">{t("actions.myRequests")}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/create">{t("actions.another")}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
