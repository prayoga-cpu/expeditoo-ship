"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
  Package,
  MapPin,
  CalendarClock,
  Inbox,
  AlertTriangle,
  HandHelping,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { useJobDetail, useJobOffers, useAcceptOffer } from "../hooks/useJobDetail";
import { useListingCarriers } from "../hooks/useListingCarriers";
import { JobBidSection } from "./JobBidSection";
import { AvailableCarriersPanel } from "./AvailableCarriersPanel";
import { OfferCard } from "./OfferCard";
import type { Job } from "../types";

interface JobDetailProps {
  listingId: string;
  /** Null when signed out; drives whether offers are visible at all. */
  viewerId: string | null;
  /**
   * Viewer holds `operator` or `admin`. Escalated Expedion jobs belong to a
   * system account nobody signs into, so without this nobody could ever award
   * one. Mirrors the rule in offersService.acceptOffer exactly — including its
   * restriction to Expedion-origin jobs — so the UI never offers an award the
   * service will refuse.
   */
  isOperator?: boolean;
}

type JobTab = "details" | "carriers";

const euros = formatCurrency;

const STATUS_TONE: Record<string, string> = {
  open: "bg-success/15 text-success border-success/30",
  awarded: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-warning/15 text-warning border-warning/30",
  draft: "bg-muted text-muted-foreground border-border",
};

/**
 * The tab lives in the URL rather than in state so a reload, a back button and
 * a shared link all land where the reader was — the pattern MyRequestsScreen
 * set. `useSearchParams` is why page.tsx must hold a Suspense boundary.
 */
function useJobTab(listingId: string) {
  const router = useRouter();
  const params = useSearchParams();

  const tab: JobTab = params.get("tab") === "carriers" ? "carriers" : "details";

  const select = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.replace(`/listing/${listingId}?${query.toString()}`, {
      scroll: false,
    });
  };

  return { tab, select };
}

export function JobDetail({
  listingId,
  viewerId,
  isOperator = false,
}: JobDetailProps) {
  const { data: job, isLoading } = useJobDetail(listingId);

  const isShipper = viewerId !== null && job?.shipperId === viewerId;
  const canAward = isOperator && job?.origin === "expedion";

  // Accepting an offer and seeing the carrier tab answer the same question -
  // may this viewer act on a job that is still open (carriers_on_route_spec
  // §5.2) - so the rule is written once and read twice.
  const canAct = (isShipper || canAward) && job?.status === "open";

  // react-query dedupes this with the panel's own read, so the badge costs no
  // second request; `enabled` is what keeps it from firing at all for a viewer
  // who never sees the tab.
  const { data: carriers } = useListingCarriers(listingId, canAct);

  if (isLoading || !job) return <PageLoader />;

  const details = (
    <JobDetailsTab
      job={job}
      listingId={listingId}
      viewerId={viewerId}
      canAccept={canAct}
    />
  );

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      {canAct ? (
        <JobTabs listingId={listingId} total={carriers?.total ?? 0}>
          {details}
        </JobTabs>
      ) : (
        details
      )}
    </div>
  );
}

/**
 * The two-tab strip, rendered only for someone who may act on this job. A
 * viewer who may not gets today's page with no strip at all rather than a
 * disabled one, because there is nothing behind it for them.
 */
function JobTabs({
  listingId,
  total,
  children,
}: {
  listingId: string;
  total: number;
  children: ReactNode;
}) {
  const t = useTranslations("myJobs.detail");
  const tCarriers = useTranslations("myJobs.carriers");
  const { tab, select } = useJobTab(listingId);

  return (
    <Tabs value={tab} onValueChange={select}>
      <TabsList className="w-full md:w-auto">
        <TabsTrigger value="details" className="flex-1 md:flex-none">
          {t("tab")}
        </TabsTrigger>
        <TabsTrigger value="carriers" className="flex-1 md:flex-none">
          {tCarriers("tab")}
          {total > 0 && (
            <Badge variant="secondary" className="ml-1.5 font-mono">
              {total}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="pt-4">
        {children}
      </TabsContent>

      <TabsContent value="carriers" className="pt-4">
        <AvailableCarriersPanel listingId={listingId} />
      </TabsContent>
    </Tabs>
  );
}

/** Today's page, unchanged in behaviour - now one of two tabs. */
function JobDetailsTab({
  job,
  listingId,
  viewerId,
  canAccept,
}: {
  job: Job;
  listingId: string;
  viewerId: string | null;
  canAccept: boolean;
}) {
  return (
    <div className="space-y-6">
      <JobHeader job={job} />
      <JobRoute job={job} />
      <JobLoad job={job} />
      <JobOffers job={job} listingId={listingId} canAccept={canAccept} />
      <JobBidSection job={job} viewerId={viewerId} />
    </div>
  );
}

function JobHeader({ job }: { job: Job }) {
  const t = useTranslations("myJobs.detail");
  // The seven job statuses are already named once, for /listings/me; a second
  // vocabulary would drift from it.
  const tStatus = useTranslations("myJobs.status");

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_TONE[job.status]}>{tStatus(job.status)}</Badge>
        {job.origin === "expedion" && (
          <Badge variant="secondary">{t("viaExpedion")}</Badge>
        )}
        {job.reopenedAt && (
          <Badge variant="outline" className="border-warning/40 text-warning">
            <RotateCcw className="mr-1 h-3 w-3" />
            {t("reopened")}
          </Badge>
        )}
        {job.isFragile && (
          <Badge variant="outline">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {t("fragile")}
          </Badge>
        )}
        {job.needsHelp && (
          <Badge variant="outline">
            <HandHelping className="mr-1 h-3 w-3" />
            {t("needsHelp")}
          </Badge>
        )}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {job.title}
      </h1>

      <p className="font-mono text-lg text-muted-foreground">
        {t("budget", { amount: euros(job.budgetCents) })}
      </p>
    </header>
  );
}

function JobLoad({ job }: { job: Job }) {
  const t = useTranslations("myJobs.detail");

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Package className="h-4 w-4 text-muted-foreground" />
        {t("load")}
      </h2>
      <Separator />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <Detail label={t("weight")} value={`${job.weightKg} kg`} />
        <Detail label={t("quantity")} value={String(job.quantity)} />
        {job.lengthCm && job.widthCm && job.heightCm && (
          <Detail
            label={t("dimensions")}
            value={`${job.lengthCm} × ${job.widthCm} × ${job.heightCm} cm`}
          />
        )}
      </dl>
      <p className="text-sm leading-relaxed text-foreground/80">
        {job.description}
      </p>
    </Card>
  );
}

function JobOffers({
  job,
  listingId,
  canAccept,
}: {
  job: Job;
  listingId: string;
  canAccept: boolean;
}) {
  const t = useTranslations("myJobs.detail");
  const [sort, setSort] = useState("price_asc");

  const { data: offers } = useJobOffers(listingId, sort);
  const acceptOffer = useAcceptOffer(listingId);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t("offers")}{" "}
          <span className="font-mono text-muted-foreground">
            ({job.offersCount})
          </span>
        </h2>

        {offers?.scope === "full" && offers.offers.length > 1 && (
          <OfferSort value={sort} onChange={setSort} />
        )}
      </div>

      <OfferSection
        offers={offers}
        job={job}
        canAccept={canAccept}
        isAccepting={acceptOffer.isPending}
        onAccept={(offerId, slotId) => acceptOffer.mutate({ offerId, slotId })}
      />
    </section>
  );
}

function OfferSort({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations("myJobs.detail");

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="price_asc">{t("sort.priceAsc")}</SelectItem>
        <SelectItem value="price_desc">{t("sort.priceDesc")}</SelectItem>
        <SelectItem value="rating_desc">{t("sort.ratingDesc")}</SelectItem>
        <SelectItem value="pickup_asc">{t("sort.pickupAsc")}</SelectItem>
        <SelectItem value="created_desc">{t("sort.createdDesc")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function JobRoute({ job }: { job: Job }) {
  const t = useTranslations("myJobs.detail");

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {t("route")}
      </h2>
      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Endpoint
          title={t("pickup")}
          address={job.pickupAddress}
          city={`${job.pickupPostalCode} ${job.pickupCity}`}
          locationType={job.pickupLocationType}
          from={job.pickupFrom}
          until={job.pickupUntil}
        />
        <Endpoint
          title={t("dropoff")}
          address={job.dropoffAddress}
          city={`${job.dropoffPostalCode} ${job.dropoffCity}`}
          locationType={job.dropoffLocationType}
          from={job.dropoffFrom}
          until={job.dropoffUntil}
        />
      </div>

      {job.isFlexible && (
        <p className="text-sm text-muted-foreground">{t("flexibleDates")}</p>
      )}
    </Card>
  );
}

function Endpoint({
  title,
  address,
  city,
  locationType,
  from,
  until,
}: {
  title: string;
  address: string;
  city: string;
  locationType: string;
  from: string;
  until: string;
}) {
  // The /create form already names every location type; reusing its catalogue
  // keeps one vocabulary for the enum instead of two that can disagree.
  const tTypes = useTranslations("create.locationTypes");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="font-medium">{address}</p>
      <p className="text-sm text-muted-foreground">{city}</p>
      <Badge variant="outline" className="mt-1">
        {tTypes(locationType)}
      </Badge>
      <p className="flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {format(new Date(from), "d MMM HH:mm", { locale: dateLocale })} –{" "}
        {format(new Date(until), "d MMM HH:mm", { locale: dateLocale })}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

/** What a carrier - or anyone else without the full view - is told instead. */
function AggregateOffers({
  count,
  lowestPriceCents,
}: {
  count: number;
  lowestPriceCents: number | null;
}) {
  const t = useTranslations("myJobs.detail");

  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{t("bidCount", { count })}</p>
      {lowestPriceCents !== null && (
        <p className="mt-1 font-mono text-lg">
          {t("lowestFrom", { amount: euros(lowestPriceCents) })}
        </p>
      )}
    </Card>
  );
}

/**
 * Renders whichever view the API granted. The scopes are the service's
 * decision, not the component's - a non-participant is never sent the offers
 * to hide (offers_engine_spec.md §6).
 */
function OfferSection({
  offers,
  job,
  canAccept,
  isAccepting,
  onAccept,
}: {
  offers: ReturnType<typeof useJobOffers>["data"];
  job: Job;
  canAccept: boolean;
  isAccepting: boolean;
  onAccept: (offerId: string, slotId?: string) => void;
}) {
  const t = useTranslations("myJobs.detail");

  if (!offers) return null;

  if (offers.scope === "aggregate") {
    return (
      <AggregateOffers
        count={offers.offersCount}
        lowestPriceCents={offers.lowestPriceCents}
      />
    );
  }

  if (offers.offers.length === 0) {
    return (
      <CenteredEmptyState
        icon={Inbox}
        title={t("noOffers")}
        description={t("noOffersDesc")}
      />
    );
  }

  const lowest = Math.min(...offers.offers.map((o) => o.priceCents));

  return (
    <div className="space-y-3">
      {offers.offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          budgetCents={job.budgetCents}
          canAccept={canAccept}
          isAccepting={isAccepting}
          isLowest={offer.priceCents === lowest}
          onAccept={onAccept}
        />
      ))}
    </div>
  );
}
