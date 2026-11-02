"use client";

import Link from "next/link";
import { useMutationState } from "@tanstack/react-query";
import { FileClock, Gavel, Truck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { SubmitOfferForm, TakeJobPanel } from "@/features/app/offers/ui";
import {
  useMyOffers,
  useWithdrawOffer,
} from "@/features/app/offers/hooks/useCarrierOffers";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/fetcher";
import type { Job, Offer } from "../types";

interface JobBidSectionProps {
  job: Job;
  /** From the server session, so ownership resolves without a client round-trip. */
  viewerId: string | null;
}

/**
 * Decides which bidding surface a viewer gets, mirroring the offers service's
 * own gates (offers.service.ts): carriers bid, only an escalated job can also
 * be taken outright, owners never see a form for their own job, and other
 * signed-in users are invited to apply. The service re-checks everything
 * server-side - this component only spares people a doomed submit.
 */
export function JobBidSection({ job, viewerId }: JobBidSectionProps) {
  const { user, isLoading } = useAuth();

  // Same source as BottomNav: roles come from the session's customSession
  // payload (src/lib/auth.ts).
  const roles = user?.roles ?? [];

  // CARRIER_NOT_APPROVED on submit means the role outlived approval (for
  // example a suspended carrier). Watching the mutation cache lets this
  // component react to that without reaching into SubmitOfferForm.
  const notApprovedSubmits = useMutationState({
    filters: {
      status: "error",
      predicate: (mutation) =>
        mutation.state.error instanceof ApiError &&
        mutation.state.error.code === "CARRIER_NOT_APPROVED",
    },
    select: (mutation) => mutation.state.submittedAt,
  });

  const isOwner = viewerId !== null && viewerId === job.shipperId;
  const bidding = viewerId !== null && !isOwner && job.status === "open";
  const isCarrier = roles.includes("carrier");

  // A carrier who already bid sees their bid, not a second form the server
  // would refuse with OFFER_ALREADY_EXISTS (no_dead_ends_spec.md §6).
  const { data: myOffers } = useMyOffers(undefined, { enabled: bidding && isCarrier });
  const mine = myOffers?.find(
    (offer) => offer.listingId === job.id && offer.status === "pending"
  );

  if (!bidding || isLoading) return null;

  if (!isCarrier) return <BecomeCarrierCard />;
  if (notApprovedSubmits.length > 0) return <NotApprovedCard />;
  if (mine) return <MyOfferCard offer={mine} />;

  // On an escalated job both routes are offered, take-it-now first. A driver
  // who wants the job at the posted price should not have to compose a bid to
  // say so, and a driver who wants to bid under it still can.
  //
  // A direct request is never taken: its requester chooses the offer and pays
  // for it themselves (take_job_spec.md), so the form is the only route there
  // — and it opens on the budget, so offering the posted price is still one
  // vehicle and a slot away. `takeJob` refuses it too, TAKE_NOT_AVAILABLE.
  return (
    <div className="space-y-4">
      {job.origin === "expedion" && <TakeJobPanel job={job} />}
      <SubmitOfferForm job={job} />
    </div>
  );
}

/** The carrier's own pending bid on this job, with the two ways on from it. */
function MyOfferCard({ offer }: { offer: Offer }) {
  const t = useTranslations("listing.bid.mine");
  const withdraw = useWithdrawOffer();

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2.5">
          <Gavel className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold">
            {t("title", { price: formatCurrency(offer.priceCents) })}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/carrier/offers">{t("all")}</Link>
        </Button>
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={withdraw.isPending}
          onClick={() => withdraw.mutate(offer.id)}
        >
          {t("withdraw")}
        </Button>
      </div>
    </Card>
  );
}

function BecomeCarrierCard() {
  const t = useTranslations("listing.bid");
  return (
    <BidPromptCard
      icon={Truck}
      tone="default"
      title={t("becomeCarrierTitle")}
      description={t("becomeCarrierDescription")}
      cta={t("becomeCarrierCta")}
    />
  );
}

function NotApprovedCard() {
  const t = useTranslations("listing.bid");
  return (
    <BidPromptCard
      icon={FileClock}
      tone="warning"
      title={t("notApprovedTitle")}
      description={t("notApprovedDescription")}
      cta={t("notApprovedCta")}
    />
  );
}

function BidPromptCard({
  icon: Icon,
  tone,
  title,
  description,
  cta,
}: {
  icon: LucideIcon;
  tone: "default" | "warning";
  title: string;
  description: string;
  cta: string;
}) {
  const warning = tone === "warning";
  return (
    <Card
      className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
        warning ? "border-warning/30" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`rounded-full p-2.5 ${warning ? "bg-warning/10" : "bg-primary/10"}`}
        >
          <Icon className={`h-5 w-5 ${warning ? "text-warning" : "text-primary"}`} />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button asChild variant={warning ? "outline" : "default"} className="shrink-0">
        <Link href="/carrier/application">{cta}</Link>
      </Button>
    </Card>
  );
}
