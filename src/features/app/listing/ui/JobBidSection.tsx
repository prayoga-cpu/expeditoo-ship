"use client";

import Link from "next/link";
import { useMutationState } from "@tanstack/react-query";
import { FileClock, Truck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitOfferForm } from "@/features/app/offers/ui";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/fetcher";
import type { Job } from "../types";

interface JobBidSectionProps {
  job: Job;
  /** From the server session, so ownership resolves without a client round-trip. */
  viewerId: string | null;
}

/**
 * Decides which bidding surface a viewer gets, mirroring the offers service's
 * own gates (offers.service.ts): carriers bid, owners never see a form for
 * their own job, and other signed-in users are invited to apply. The service
 * re-checks everything server-side - this component only spares people a
 * doomed submit.
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
  if (viewerId === null || isOwner || job.status !== "open") return null;
  if (isLoading) return null;

  if (!roles.includes("carrier")) return <BecomeCarrierCard />;
  if (notApprovedSubmits.length > 0) return <NotApprovedCard />;

  return <SubmitOfferForm job={job} />;
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
